import { z } from "zod";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_BASE_URL,
  SYNTHESIS_TOP_N
} from "@/lib/config";
import { fetchWithRetry, FetchError } from "@/lib/fetchWithRetry";
import { PlanDataSchema, type PlanData } from "@/lib/playground/types";
import { collectPointerUniverse } from "@/lib/playground/engine";
import {
  SynthesisV2Schema,
  synthesisV2JsonSchema,
  type SynthesisV2
} from "@/lib/synthesisSchemaV2";
import { resolveSingleCharTypoId } from "@/lib/idNormalization";

export const SynthesizeV2RequestSchema = z.object({
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional(),
  planData: PlanDataSchema
});

export type SynthesizeV2Request = z.infer<typeof SynthesizeV2RequestSchema>;

type SynthesisV2Warnings = {
  warnings: string[];
};

function normalizeList(values: string[], cap: number): string[] {
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

function topMoments(planData: PlanData): PlanData["moments"] {
  return [...planData.moments]
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    })
    .slice(0, SYNTHESIS_TOP_N);
}

function extractStructuredJson(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload malformed.");
  }

  const asAny = payload as Record<string, unknown>;
  if (typeof asAny.output_text === "string" && asAny.output_text.trim()) {
    return JSON.parse(asAny.output_text);
  }

  if (Array.isArray(asAny.output)) {
    for (const item of asAny.output) {
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const segment of content) {
        const typed = segment as { text?: unknown; json?: unknown };
        if (typeof typed.text === "string" && typed.text.trim()) {
          return JSON.parse(typed.text);
        }
        if (typed.json && typeof typed.json === "object") {
          return typed.json;
        }
      }
    }
  }

  throw new Error("Could not extract structured JSON from OpenAI response.");
}

function buildSignalDigest(planData: PlanData): {
  trends: string[];
  reddit: string[];
  wiki: string[];
} {
  return {
    trends: normalizeList(
      [
        ...(planData.signals.googleTrends?.topRelatedQueries || []).map((item) => item.query),
        ...(planData.signals.googleTrends?.topRelatedTopics || []).map((item) => item.topic)
      ],
      10
    ),
    reddit: normalizeList(
      [
        ...(planData.signals.reddit?.commonThemes || []),
        ...(planData.signals.reddit?.subredditCandidates || []).map((item) => item.name)
      ],
      10
    ),
    wiki: normalizeList((planData.signals.wikimedia?.entities || []).map((item) => item.title), 10)
  };
}

function systemPrompt(): string {
  return [
    "You are generating a non-hallucinatory cultural planning synthesis.",
    "Use only provided PlanData (playground, moments, signals, insights).",
    "Never invent facts, events, dates, times, venues, opponents, or titles.",
    "Reference moments only by momentId values from provided moments.",
    "Any evidencePointers must be exact pointers from the provided pointer list.",
    "If signals/insights are sparse, keep output best-effort and add notes.",
    "Return valid JSON under the schema."
  ].join(" ");
}

function userPrompt(input: {
  planData: PlanData;
  allowedPointers: string[];
  corrective?: {
    invalidIds?: string[];
    invalidPointers?: string[];
    reasons?: string[];
  };
}): string {
  const topSignals = buildSignalDigest(input.planData);
  const compactMoments = topMoments(input.planData).map((moment) => ({
    id: moment.id,
    category: moment.category,
    score: moment.finalScore,
    signalBoost: moment.signalBoost,
    evidencePointers: moment.evidencePointers,
    tags: moment.tags,
    subcategory: moment.subcategory
  }));

  const lines: string[] = [
    "Produce SynthesisV2 for this planning input.",
    `Playground:\n${JSON.stringify(input.planData.playground)}`,
    `Moments:\n${JSON.stringify(compactMoments)}`,
    `Signals digest:\n${JSON.stringify(topSignals)}`,
    `Allowed evidence pointers:\n${JSON.stringify(input.allowedPointers.slice(0, 400))}`,
    input.planData.insights ? `Insights:\n${JSON.stringify(input.planData.insights)}` : "Insights: not provided"
  ];

  if (input.corrective) {
    if (input.corrective.invalidIds?.length) {
      lines.push(`Correction: invalid moment ids were ${input.corrective.invalidIds.join(", ")}.`);
    }
    if (input.corrective.invalidPointers?.length) {
      lines.push(
        `Correction: invalid pointers were ${input.corrective.invalidPointers.join(", ")}. Use only allowed pointers.`
      );
    }
    if (input.corrective.reasons?.length) {
      lines.push(`Correction notes:\n${input.corrective.reasons.map((item) => `- ${item}`).join("\n")}`);
    }
  }

  return lines.join("\n\n");
}

function normalizeMomentIds(synthesis: SynthesisV2, allowedMomentIds: Set<string>): SynthesisV2 {
  const normalize = (id: string): string => resolveSingleCharTypoId(id, allowedMomentIds) || id;
  return {
    ...synthesis,
    opportunities: synthesis.opportunities.map((item) => ({
      ...item,
      momentId: normalize(item.momentId)
    })),
    themes: synthesis.themes.map((theme) => ({
      ...theme,
      momentIds: theme.momentIds.map(normalize)
    }))
  };
}

function invalidMomentIds(synthesis: SynthesisV2, allowedMomentIds: Set<string>): string[] {
  const ids = new Set<string>();
  synthesis.opportunities.forEach((item) => ids.add(item.momentId));
  synthesis.themes.forEach((theme) => theme.momentIds.forEach((id) => ids.add(id)));
  return Array.from(ids).filter((id) => !allowedMomentIds.has(id));
}

function canonicalizePointer(
  pointer: string,
  primaryAllowed: Set<string>,
  fallbackAllowed?: Set<string>
): string {
  const direct = pointer.replace(/\s+/g, " ").trim();
  if (!direct) {
    return direct;
  }

  const candidates = [primaryAllowed];
  if (fallbackAllowed) {
    candidates.push(fallbackAllowed);
  }

  const hasCandidate = (value: string): boolean =>
    candidates.some((allowed) => allowed.has(value));

  if (hasCandidate(direct)) {
    return direct;
  }

  const dotIndex = direct.replace(/\.([0-9]+)(?=\.|$)/g, "[$1]");
  if (hasCandidate(dotIndex)) {
    return dotIndex;
  }

  let shortened = dotIndex;
  while (shortened.includes(".")) {
    const next = shortened.replace(/\.[^.[]+$/, "");
    if (next === shortened) {
      break;
    }
    shortened = next;
    if (hasCandidate(shortened)) {
      return shortened;
    }
  }

  return direct;
}

function normalizeEvidencePointers(input: {
  synthesis: SynthesisV2;
  allPointers: Set<string>;
  byMomentPointers: Map<string, Set<string>>;
}): SynthesisV2 {
  const normalizeForMoment = (momentId: string, pointers: string[]): string[] => {
    const byMoment = input.byMomentPointers.get(momentId);
    const primaryAllowed = byMoment && byMoment.size > 0 ? byMoment : input.allPointers;
    return normalizeList(
      pointers.map((pointer) => canonicalizePointer(pointer, primaryAllowed, input.allPointers)),
      20
    );
  };

  const normalizeGlobal = (pointers: string[]): string[] =>
    normalizeList(
      pointers.map((pointer) => canonicalizePointer(pointer, input.allPointers)),
      20
    );

  return {
    ...input.synthesis,
    playground: {
      ...input.synthesis.playground,
      evidencePointers: normalizeGlobal(input.synthesis.playground.evidencePointers)
    },
    opportunities: input.synthesis.opportunities.map((opportunity) => ({
      ...opportunity,
      evidencePointers: normalizeForMoment(opportunity.momentId, opportunity.evidencePointers)
    })),
    themes: input.synthesis.themes.map((theme) => ({
      ...theme,
      evidencePointers: normalizeGlobal(theme.evidencePointers)
    })),
    proofOfUse: {
      ...input.synthesis.proofOfUse,
      evidence: input.synthesis.proofOfUse.evidence.map((evidence) => ({
        ...evidence,
        pointers: normalizeGlobal(evidence.pointers)
      }))
    }
  };
}

function invalidPointers(input: {
  synthesis: SynthesisV2;
  planData: PlanData;
  allPointers: Set<string>;
  byMomentPointers: Map<string, Set<string>>;
}): string[] {
  const invalid = new Set<string>();

  const check = (pointer: string, allowed: Set<string>): void => {
    if (!allowed.has(pointer)) {
      invalid.add(pointer);
    }
  };

  const globalAllowed = input.allPointers;

  for (const opportunity of input.synthesis.opportunities) {
    const byMoment = input.byMomentPointers.get(opportunity.momentId);
    const allowed = byMoment && byMoment.size > 0 ? byMoment : globalAllowed;
    for (const pointer of opportunity.evidencePointers) {
      check(pointer, allowed);
    }
  }

  for (const theme of input.synthesis.themes) {
    for (const pointer of theme.evidencePointers) {
      check(pointer, globalAllowed);
    }
  }

  for (const evidence of input.synthesis.proofOfUse.evidence) {
    for (const pointer of evidence.pointers) {
      check(pointer, globalAllowed);
    }
  }

  for (const pointer of input.synthesis.playground.evidencePointers) {
    check(pointer, globalAllowed);
  }

  return Array.from(invalid);
}

function enforceProofBestEffort(input: {
  synthesis: SynthesisV2;
  planData: PlanData;
  wikiMatchedMomentIds: string[];
}): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const hasInsights = Boolean(input.planData.insights?.audience || input.planData.insights?.search);
  const hasSignals =
    (input.planData.signals.googleTrends?.topRelatedQueries.length || 0) +
      (input.planData.signals.reddit?.topPosts.length || 0) +
      (input.planData.signals.wikimedia?.entities.length || 0) >
    0;

  if (hasInsights && !input.synthesis.proofOfUse.usedSources.some((source) => source === "audienceCsv" || source === "searchCsv")) {
    reasons.push("Include audienceCsv/searchCsv in proofOfUse.usedSources when insights are provided.");
  }
  if (hasSignals && input.synthesis.proofOfUse.usedSources.length === 0) {
    reasons.push("Include signal sources in proofOfUse.usedSources.");
  }
  if ((hasInsights || hasSignals) && input.synthesis.proofOfUse.evidence.length < 3) {
    reasons.push("Add at least 3 evidence statements when signals or insights exist.");
  }

  const wikiMatchesCount = input.planData.meta.wikiMatchesCount;
  if (wikiMatchesCount > 0) {
    if (!input.synthesis.proofOfUse.usedSources.includes("wikimedia")) {
      reasons.push("Include wikimedia in proofOfUse.usedSources when wiki matches exist.");
    }
    const opportunitiesWithWikiPointers = input.synthesis.opportunities.filter((opportunity) =>
      opportunity.evidencePointers.some((pointer) => pointer.includes("signals.wikimedia.entities"))
    ).length;

    const possible = input.wikiMatchedMomentIds.length;
    if (possible >= 2 && opportunitiesWithWikiPointers < 2) {
      reasons.push("Try to include wikimedia pointers in at least 2 opportunities.");
    } else if (possible > 0 && opportunitiesWithWikiPointers < Math.min(2, possible)) {
      warnings.push("Wikimedia matches were limited; included available wiki evidence where possible.");
    }
  }

  return { reasons, warnings };
}

async function callOpenAi(input: {
  planData: PlanData;
  allowedPointers: string[];
  corrective?: {
    invalidIds?: string[];
    invalidPointers?: string[];
    reasons?: string[];
  };
}): Promise<SynthesisV2> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetchWithRetry(
    `${OPENAI_BASE_URL}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt() }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt(input) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: synthesisV2JsonSchema.name,
            schema: synthesisV2JsonSchema.schema,
            strict: true
          }
        }
      })
    },
    { timeoutMs: 30_000, retries: 2, backoffMs: 500 }
  );

  const payload = await response.json();
  const structured = extractStructuredJson(payload);
  const parsed = SynthesisV2Schema.safeParse(structured);
  if (!parsed.success) {
    throw new Error(`Structured synthesis v2 validation failed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export async function synthesizePlanDataV2(
  input: SynthesizeV2Request
): Promise<{ synthesis: SynthesisV2; warnings: string[] }> {
  const planData = PlanDataSchema.parse(input.planData);
  const allowedMomentIds = new Set(planData.moments.map((moment) => moment.id));
  const pointerUniverse = collectPointerUniverse(planData);
  const allowedPointers = Array.from(pointerUniverse.all);

  const tryParse = async (corrective?: {
    invalidIds?: string[];
    invalidPointers?: string[];
    reasons?: string[];
  }): Promise<{
    synthesis: SynthesisV2;
    invalidIds: string[];
    invalidPointerList: string[];
    bestEffort: { reasons: string[]; warnings: string[] };
  }> => {
    const raw = await callOpenAi({
      planData,
      allowedPointers,
      corrective
    });
    const normalizedIds = normalizeMomentIds(raw, allowedMomentIds);
    const normalized = normalizeEvidencePointers({
      synthesis: normalizedIds,
      allPointers: pointerUniverse.all,
      byMomentPointers: pointerUniverse.byMoment
    });
    const invalidIdsList = invalidMomentIds(normalized, allowedMomentIds);
    const invalidPointerList = invalidPointers({
      synthesis: normalized,
      planData,
      allPointers: pointerUniverse.all,
      byMomentPointers: pointerUniverse.byMoment
    });
    const bestEffort = enforceProofBestEffort({
      synthesis: normalized,
      planData,
      wikiMatchedMomentIds: pointerUniverse.wikiMatchedMomentIds
    });
    return {
      synthesis: normalized,
      invalidIds: invalidIdsList,
      invalidPointerList,
      bestEffort
    };
  };

  let first;
  try {
    first = await tryParse();
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw error;
  }

  if (
    first.invalidIds.length === 0 &&
    first.invalidPointerList.length === 0 &&
    first.bestEffort.reasons.length === 0
  ) {
    return {
      synthesis: first.synthesis,
      warnings: first.bestEffort.warnings
    };
  }

  const second = await tryParse({
    invalidIds: first.invalidIds,
    invalidPointers: first.invalidPointerList,
    reasons: first.bestEffort.reasons
  });

  if (second.invalidIds.length > 0) {
    const error = new Error("Synthesis v2 moment id validation failed.") as Error & {
      invalidIds?: string[];
      allowedIds?: string[];
    };
    error.invalidIds = second.invalidIds;
    error.allowedIds = Array.from(allowedMomentIds);
    throw error;
  }

  if (second.invalidPointerList.length > 0) {
    const error = new Error("Synthesis v2 evidence pointer validation failed.") as Error & {
      invalidPointers?: string[];
      allowedPointers?: string[];
    };
    error.invalidPointers = second.invalidPointerList;
    error.allowedPointers = allowedPointers;
    throw error;
  }

  const synthesis = second.synthesis;
  const warnings = [...second.bestEffort.warnings];
  if (second.bestEffort.reasons.length > 0) {
    warnings.push("Limited signals available; proof fields may be sparse.");
    synthesis.notes = normalizeList(
      [...synthesis.notes, "Limited signals available; proof fields may be sparse."],
      12
    );
  }

  return {
    synthesis,
    warnings
  };
}
