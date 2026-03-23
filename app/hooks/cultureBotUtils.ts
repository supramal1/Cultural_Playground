import { signalScaleSummary } from "@/lib/signalScale";
import type { PlanData } from "@/lib/playground/types";
import type { PlaygroundBlueprint, MediaOwnerBrief } from "@/lib/briefBuilder/types";
import type { OpportunityContextResponse } from "@/lib/playground/perplexityContext";
import type { InsightsPayload } from "@/lib/insights/types";

// ── Shared types ────────────────────────────────────────────────────────────

export type Step = "brief" | "playground" | "audience" | "builder" | "proof";

export type UploadDebug = {
  detectedHeaderLine?: number | null;
  parsedRowCount?: number;
  firstNonEmptyLine?: string;
  headerRow?: string | null;
  parseLogTail?: string;
};

export type UploadState = {
  status: "NOT_UPLOADED" | "UPLOADING" | "OK" | "FAILED";
  error?: string;
  debug?: UploadDebug | null;
};

export type PlaygroundMeta = {
  warnings?: string[];
  queryStrategy?: Record<string, unknown>;
  providerStatus?: Record<string, unknown>;
  keywordSetInPlayPreview?: string[];
  queriesUsed?: string[];
};

export type BriefPayload = {
  brand?: string;
  objective?: string;
  audienceKeyword: string;
  from: string;
  to: string;
  categories?: ("sports" | "film" | "holidays" | "events")[];
  boostKeywords: string[];
};

// ── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIES: Array<"sports" | "film" | "holidays" | "events"> = [
  "sports",
  "film",
  "holidays",
  "events"
];

export const INSIGHTS_STORAGE_KEY = "culture-bot:v3:insights";
export const SNAPSHOT_STORAGE_KEY = "culture-bot:v3:snapshot";

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function parseCsvList(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function dedupe(values: string[], cap = 60): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
    if (output.length >= cap) {
      break;
    }
  }
  return output;
}

export function nowDate(days = 0): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function pointerLabel(pointer: string): string {
  if (pointer.includes("googleTrends") || pointer.includes("search")) return "Demand";
  if (pointer.includes("reddit") || pointer.includes("audience")) return "Conversation";
  if (pointer.includes("wikimedia")) return "Attention";
  if (pointer.includes("brandSignals") || pointer.includes("brandDiscourseContext")) return "Brand";
  if (pointer.includes("playgroundContext") || pointer.includes("opportunityContext")) return "Perplexity";
  return "Evidence";
}

export function readPath(root: unknown, pointer: string): unknown {
  const normalized = pointer.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "");
  if (!normalized) {
    return root;
  }

  const parts = normalized.split(".").filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) {
        return undefined;
      }
      current = current[idx];
      continue;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvFromMoments(moments: PlanData["moments"]): string {
  const header = ["date", "title", "category", "qualityTier", "baseScore", "finalScore", "sourceName", "sourceUrl"].join(",");
  const rows = moments.map((moment) => {
    const cols = [
      formatDate(moment.startDateTime),
      moment.title,
      moment.category,
      moment.qualityTier || "filler",
      String(moment.baseScore.toFixed(1)),
      String(moment.finalScore.toFixed(1)),
      moment.sourceName,
      moment.sourceUrl
    ];
    return cols
      .map((value) => (value.includes(",") || value.includes("\n") ? `"${value.replace(/"/g, '""')}"` : value))
      .join(",");
  });
  return [header, ...rows].join("\n");
}

// ── API helpers (used by sub-hooks) ──────────────────────────────────────────

export async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type ApiError = {
  error?: string;
  details?: unknown;
};

export function apiErrorMessage(payload: ApiError | null | undefined, fallback: string): string {
  if (!payload) {
    return fallback;
  }
  const base = payload.error || fallback;
  if (payload.details == null) {
    return base;
  }
  const details =
    typeof payload.details === "string"
      ? payload.details
      : JSON.stringify(payload.details);
  return `${base}: ${details}`.slice(0, 1200);
}

// ── Brief export formatters ───────────────────────────────────────────────────

export function toEmailBrief(input: {
  brief: MediaOwnerBrief;
  blueprint?: PlaygroundBlueprint | null;
  planData?: PlanData | null;
  opportunityContext?: OpportunityContextResponse | null;
  selectedMomentIds: string[];
  from?: string;
  to?: string;
}): string {
  const lines: string[] = [];
  lines.push(`Subject: ${input.brief.briefOneLiner}`);
  if (input.brief.cultureSnapshot) {
    lines.push("");
    lines.push(`Culture snapshot: ${input.brief.cultureSnapshot}`);
  }
  if (input.brief.culturalTension) {
    lines.push("");
    lines.push(`Cultural tension: ${input.brief.culturalTension}`);
  }
  if (input.brief.timingWindow) {
    lines.push("");
    lines.push(`Timing window: ${input.brief.timingWindow}`);
  }
  lines.push("");
  lines.push(`Objective + KPI: ${input.brief.objectiveKpi}`);
  lines.push("");
  lines.push(`Audience mindset: ${input.brief.audienceMindset}`);
  lines.push("");
  lines.push(`Playground + codes: ${input.brief.playgroundDefinitionCodes}`);
  lines.push("");
  lines.push(`The ask: ${input.brief.theAsk}`);

  if (input.from && input.to) {
    lines.push("");
    lines.push(`Timing: ${formatDate(input.from)} – ${formatDate(input.to)}`);
    const t = input.brief.timing;
    lines.push(`Lead-in: ${t.leadInDays}d, Peak: ${t.peakDays}d, Cool-down: ${t.coolDownDays}d`);
  }

  lines.push("");
  lines.push("Deliverables:");
  input.brief.deliverables.forEach((item) => lines.push(`- ${item}`));

  lines.push("");
  lines.push("Guardrails:");
  input.brief.guardrails.forEach((item) => lines.push(`- ${item}`));

  if (input.blueprint?.cultureCodes?.length) {
    lines.push("");
    lines.push("Culture codes:");
    input.blueprint.cultureCodes.slice(0, 5).forEach((code) =>
      lines.push(`- ${code.phrase}: ${code.meaning}`)
    );
  }

  if (input.planData && input.selectedMomentIds.length > 0) {
    const byId = new Map(input.planData.moments.map((moment) => [moment.id, moment]));
    const briefMomentMap = new Map(
      (input.brief.momentsToBuildAround || []).map((m) => [m.momentId, m])
    );
    lines.push("");
    lines.push("Moments we'll build around:");
    input.selectedMomentIds.forEach((momentId) => {
      const moment = byId.get(momentId);
      if (!moment) return;
      const tier = moment.qualityTier ? ` [${moment.qualityTier}]` : "";
      lines.push(`- ${formatDate(moment.startDateTime)} | ${moment.title}${tier} | ${moment.sourceUrl}`);
      const briefMoment = briefMomentMap.get(momentId);
      if (briefMoment?.culturalBehaviour) {
        lines.push(`    Cultural behaviour: ${briefMoment.culturalBehaviour}`);
      }
      if (briefMoment?.audienceState) {
        lines.push(`    Audience state: ${briefMoment.audienceState}`);
      }
      const ctx = input.opportunityContext?.byMomentId[momentId];
      if (ctx?.whyNowBullets?.length) {
        ctx.whyNowBullets.slice(0, 2).forEach((bullet) => lines.push(`    - ${bullet}`));
      }
    });
  }

  if (input.planData) {
    const scale = signalScaleSummary({
      wikiEntities: input.planData.signals.wikimedia?.entities,
      trendsQueries: input.planData.signals.googleTrends?.topRelatedQueries,
      redditPosts: input.planData.signals.reddit?.topPosts,
      guardianArticles: input.planData.signals.guardian?.articles
    });
    if (scale.length > 0) {
      lines.push("");
      lines.push("Signal scale:");
      scale.forEach((item) => lines.push(`- ${item}`));
    }
  }

  lines.push("");
  lines.push("## Proof appendix");
  lines.push("### Signal evidence");
  input.brief.proofAppendix.signalBullets.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("### Citations");
  input.brief.proofAppendix.citations.forEach((item) => lines.push(`- ${item}`));

  return lines.join("\n");
}

export function toMarkdownBrief(input: {
  brief: MediaOwnerBrief;
  blueprint?: PlaygroundBlueprint | null;
  planData?: PlanData | null;
  opportunityContext?: OpportunityContextResponse | null;
  selectedMomentIds: string[];
  from?: string;
  to?: string;
}): string {
  const lines: string[] = [];
  lines.push(`# ${input.brief.briefOneLiner}`);
  if (input.brief.cultureSnapshot) {
    lines.push("");
    lines.push(`> ${input.brief.cultureSnapshot}`);
  }
  if (input.brief.culturalTension) {
    lines.push("");
    lines.push(`> **Cultural tension:** ${input.brief.culturalTension}`);
  }
  if (input.brief.timingWindow) {
    lines.push("");
    lines.push(`> **Timing window:** ${input.brief.timingWindow}`);
  }
  lines.push("");
  lines.push(`## Objective + KPI\n${input.brief.objectiveKpi}`);
  lines.push("");
  lines.push(`## Audience mindset\n${input.brief.audienceMindset}`);
  lines.push("");
  lines.push(`## Playground definition + codes\n${input.brief.playgroundDefinitionCodes}`);
  lines.push("");
  lines.push(`## The ask\n${input.brief.theAsk}`);

  if (input.from && input.to) {
    lines.push("");
    lines.push(`## Timing\n**Window:** ${formatDate(input.from)} – ${formatDate(input.to)}`);
    const t = input.brief.timing;
    lines.push(`- Lead-in: ${t.leadInDays} days`);
    lines.push(`- Peak: ${t.peakDays} days`);
    lines.push(`- Cool-down: ${t.coolDownDays} days`);
  }

  lines.push("");
  lines.push("## Deliverables");
  input.brief.deliverables.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("## Guardrails");
  input.brief.guardrails.forEach((item) => lines.push(`- ${item}`));

  if (input.blueprint?.cultureCodes?.length) {
    lines.push("");
    lines.push("## Culture codes");
    input.blueprint.cultureCodes.slice(0, 5).forEach((code) => lines.push(`- **${code.phrase}**: ${code.meaning}`));
  }

  if (input.blueprint?.communityMap?.length) {
    lines.push("");
    lines.push("## Key communities");
    input.blueprint.communityMap.slice(0, 4).forEach((c) => lines.push(`- **${c.community}**: ${c.careAbout}`));
  }

  if (input.planData && input.selectedMomentIds.length > 0) {
    const byId = new Map(input.planData.moments.map((moment) => [moment.id, moment]));
    const briefMomentMap = new Map(
      (input.brief.momentsToBuildAround || []).map((m) => [m.momentId, m])
    );
    lines.push("");
    lines.push("## Moments we'll build around");
    input.selectedMomentIds.forEach((momentId) => {
      const moment = byId.get(momentId);
      if (!moment) return;
      const tier = moment.qualityTier ? ` \`${moment.qualityTier}\`` : "";
      lines.push(`- **${formatDate(moment.startDateTime)}** | ${moment.title}${tier} | [source](${moment.sourceUrl})`);
      const briefMoment = briefMomentMap.get(momentId);
      if (briefMoment?.culturalBehaviour) {
        lines.push(`  - **Cultural behaviour**: ${briefMoment.culturalBehaviour}`);
      }
      if (briefMoment?.audienceState) {
        lines.push(`  - **Audience state**: ${briefMoment.audienceState}`);
      }
      const ctx = input.opportunityContext?.byMomentId[momentId];
      if (ctx?.whyNowBullets?.length) {
        ctx.whyNowBullets.slice(0, 2).forEach((bullet) => lines.push(`  - ${bullet}`));
      }
    });
  }

  if (input.planData) {
    const scale = signalScaleSummary({
      wikiEntities: input.planData.signals.wikimedia?.entities,
      trendsQueries: input.planData.signals.googleTrends?.topRelatedQueries,
      redditPosts: input.planData.signals.reddit?.topPosts,
      guardianArticles: input.planData.signals.guardian?.articles
    });
    if (scale.length > 0) {
      lines.push("");
      lines.push("## Signal scale");
      scale.forEach((item) => lines.push(`- ${item}`));
    }
  }

  lines.push("");
  lines.push("## Proof appendix");
  lines.push("### Signal evidence");
  input.brief.proofAppendix.signalBullets.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("### Citations");
  input.brief.proofAppendix.citations.forEach((item) => lines.push(`- ${item}`));

  return lines.join("\n");
}
