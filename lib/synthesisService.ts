import { z } from "zod";
import {
  DEFAULT_OPENAI_MODEL,
  MAX_DATE_RANGE_DAYS,
  OPENAI_BASE_URL,
  SYNTHESIS_TOP_N
} from "@/lib/config";
import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import { ScoredMomentSchema, type ScoredMoment } from "@/lib/schemas/moment";
import {
  SynthesisSchema,
  synthesisJsonSchema,
  type Synthesis
} from "@/lib/schemas/synthesis";
import { resolveSingleCharTypoId } from "@/lib/idNormalization";
import { InsightsPayloadSchema, type InsightsPayload } from "@/lib/insights/types";
import { SignalsBundleSchema, type SignalsBundle } from "@/lib/signals/types";

export const SynthesizeRequestSchema = z.object({
  moments: z.array(ScoredMomentSchema).min(1),
  audience: z.string().optional(),
  brandConstraints: z.string().optional(),
  insights: InsightsPayloadSchema.optional(),
  signals: SignalsBundleSchema.optional(),
  includeAll: z.boolean().optional().default(false)
});

export type SynthesizeRequest = z.infer<typeof SynthesizeRequestSchema>;

type InsightsDigest = {
  topAffinities: string[];
  risingQueries: string[];
};

type SignalsDigest = {
  trendsRising: string[];
  redditThemes: string[];
  wikimediaEntities: string[];
};

export type SynthesisProof = {
  insightsProvided: boolean;
  signalsProvided: boolean;
  insightsUsed: boolean;
  signalsUsed: boolean;
  evidenceCount: number;
  audienceSignalsUsedCount: number;
  searchSignalsUsedCount: number;
  signalsUsedCount: number;
  reasons: string[];
};

function normalizeList(input: string[], cap: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of input) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
    if (result.length >= cap) {
      break;
    }
  }

  return result;
}

function buildInsightsDigest(insights?: InsightsPayload): InsightsDigest {
  return {
    topAffinities: normalizeList(
      insights?.audience?.topAffinities.slice(0, 8).map((item) => item.item) || [],
      8
    ),
    risingQueries: normalizeList(
      insights?.search?.queriesLatestMonth.byTrend.fastRising.slice(0, 8).map((item) => item.query) || [],
      8
    )
  };
}

function buildSignalsDigest(signals?: SignalsBundle): SignalsDigest {
  return {
    trendsRising: normalizeList(
      signals?.googleTrends?.topRelatedQueries
        .filter((item) => item.type === "rising")
        .slice(0, 8)
        .map((item) => item.query) || [],
      8
    ),
    redditThemes: normalizeList(signals?.reddit?.commonThemes.slice(0, 5) || [], 5),
    wikimediaEntities: normalizeList(
      signals?.wikimedia?.entities.slice(0, 5).map((item) => item.title) || [],
      5
    )
  };
}

function rangeWithinLimit(moments: ScoredMoment[]): boolean {
  if (moments.length === 0) {
    return true;
  }

  const sorted = [...moments].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );
  const first = new Date(sorted[0].startDateTime).getTime();
  const last = new Date(sorted[sorted.length - 1].startDateTime).getTime();
  const days = Math.floor((last - first) / (24 * 60 * 60 * 1000));
  return days <= MAX_DATE_RANGE_DAYS;
}

function topMomentsForSynthesis(moments: ScoredMoment[], includeAll: boolean): ScoredMoment[] {
  if (includeAll) {
    return moments;
  }
  const sorted = [...moments].sort((a, b) => b.score - a.score);
  return sorted.slice(0, SYNTHESIS_TOP_N);
}

function extractStructuredJson(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload malformed.");
  }

  const asAny = payload as Record<string, unknown>;

  if (typeof asAny.output_text === "string" && asAny.output_text.trim()) {
    return JSON.parse(asAny.output_text);
  }

  const output = asAny.output;
  if (Array.isArray(output)) {
    for (const item of output) {
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

function systemPrompt(): string {
  return [
    "You are assisting planners by structuring a non-hallucinatory planning synthesis.",
    "You may only use the provided moments and digests.",
    "Do not add or guess any factual details.",
    "Never introduce new events, dates, times, venues, opponents, or entities.",
    "Reference moments only by moment ids.",
    "Never use factual specifics in prose (no dates, times, venues, opponents, or event titles).",
    "Narrative language must stay generic.",
    "Return 3-5 themes only.",
    "Each theme must include 3-8 momentIds, max 3 activationAngles, max 4 channels, max 2 risks.",
    "Timing fields must be day counts only.",
    "Populate proof fields from digests only:",
    "- audienceSignalsUsed must contain exact strings from insightsDigest.topAffinities",
    "- searchSignalsUsed must contain exact strings from insightsDigest.risingQueries",
    "- signalsUsed must contain exact strings from signalsDigest values",
    "Evidence pointers must reference provided JSON paths only (e.g. insightsDigest.topAffinities[0], signalsDigest.wikimediaEntities[1], moments[3].id)."
  ].join(" ");
}

function userPrompt(input: {
  moments: ScoredMoment[];
  insightsDigest: InsightsDigest;
  signalsDigest: SignalsDigest;
  audience?: string;
  brandConstraints?: string;
  corrective?: {
    invalidIds?: string[];
    allowedIds?: string[];
    proofReasons?: string[];
  };
}): string {
  const lines = [
    "Use this JSON input of moments to produce synthesis output under schema constraints.",
    "Theme ids should be short stable slugs based on the theme title.",
    "Keep all narrative generic and strategy-oriented.",
    `Audience: ${input.audience || "General UK planners and strategists"}`,
    `Brand constraints: ${input.brandConstraints || "None provided"}`,
    `Moments JSON:\n${JSON.stringify(input.moments)}`,
    `insightsDigest JSON:\n${JSON.stringify(input.insightsDigest)}`,
    `signalsDigest JSON:\n${JSON.stringify(input.signalsDigest)}`
  ];

  if (input.corrective?.invalidIds && input.corrective.invalidIds.length > 0) {
    lines.push(
      `Correction: previous output contained invalid momentIds: ${input.corrective.invalidIds.join(", ")}.`,
      `Allowed moment ids are only: ${(input.corrective.allowedIds || []).join(", ")}.`
    );
  }

  if (input.corrective?.proofReasons && input.corrective.proofReasons.length > 0) {
    lines.push(
      "Correction: proof-of-use requirements were not met:",
      ...input.corrective.proofReasons.map((reason) => `- ${reason}`)
    );
  }

  return lines.join("\n\n");
}

function normalizeEvidencePointers(synthesis: Synthesis): Synthesis {
  return {
    ...synthesis,
    audienceSignalsUsed: normalizeList(synthesis.audienceSignalsUsed || [], 12),
    searchSignalsUsed: normalizeList(synthesis.searchSignalsUsed || [], 12),
    signalsUsed: normalizeList(synthesis.signalsUsed || [], 12),
    evidence: (synthesis.evidence || []).slice(0, 6).map((item) => ({
      ...item,
      pointers: normalizeList(item.pointers || [], 6)
    }))
  };
}

function collectReferencedMomentIds(synthesis: Synthesis): string[] {
  const ids = new Set<string>();
  for (const id of synthesis.topMomentIds) {
    ids.add(id);
  }
  for (const theme of synthesis.themes) {
    for (const id of theme.momentIds) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

export function invalidReferencedIds(synthesis: Synthesis, allowedIds: Set<string>): string[] {
  return collectReferencedMomentIds(synthesis).filter((id) => !allowedIds.has(id));
}

export function normalizeSynthesisReferencedIds(
  synthesis: Synthesis,
  allowedIds: Set<string>
): Synthesis {
  const normalize = (id: string): string => resolveSingleCharTypoId(id, allowedIds) || id;

  return {
    ...synthesis,
    topMomentIds: synthesis.topMomentIds.map(normalize),
    themes: synthesis.themes.map((theme) => ({
      ...theme,
      momentIds: theme.momentIds.map(normalize)
    }))
  };
}

function matchCount(values: string[], allowed: Set<string>): number {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .filter((value) => allowed.has(value)).length;
}

function validateProofOfUse(input: {
  synthesis: Synthesis;
  request: SynthesizeRequest;
  insightsDigest: InsightsDigest;
  signalsDigest: SignalsDigest;
}): SynthesisProof {
  const reasons: string[] = [];
  const hasAudienceInsights = Boolean(input.request.insights?.audience);
  const hasSearchInsights = Boolean(input.request.insights?.search);
  const hasSignals = Boolean(input.request.signals);

  const audienceSet = new Set(input.insightsDigest.topAffinities.map((item) => item.toLowerCase()));
  const searchSet = new Set(input.insightsDigest.risingQueries.map((item) => item.toLowerCase()));
  const signalsSet = new Set(
    [
      ...input.signalsDigest.trendsRising,
      ...input.signalsDigest.redditThemes,
      ...input.signalsDigest.wikimediaEntities
    ].map((item) => item.toLowerCase())
  );

  const audienceSignalsUsedCount = matchCount(input.synthesis.audienceSignalsUsed || [], audienceSet);
  const searchSignalsUsedCount = matchCount(input.synthesis.searchSignalsUsed || [], searchSet);
  const signalsUsedCount = matchCount(input.synthesis.signalsUsed || [], signalsSet);

  if (hasAudienceInsights && audienceSignalsUsedCount < 3) {
    reasons.push("audienceSignalsUsed must include at least 3 exact strings from insightsDigest.topAffinities.");
  }
  if (hasSearchInsights && searchSignalsUsedCount < 3) {
    reasons.push("searchSignalsUsed must include at least 3 exact strings from insightsDigest.risingQueries.");
  }
  if (hasSignals && signalsUsedCount < 2) {
    reasons.push("signalsUsed must include at least 2 exact strings from signalsDigest values.");
  }

  const insightsOrSignalsProvided = hasAudienceInsights || hasSearchInsights || hasSignals;
  if (insightsOrSignalsProvided && (input.synthesis.evidence || []).length < 3) {
    reasons.push("evidence must include at least 3 items when insights or signals are provided.");
  }

  return {
    insightsProvided: hasAudienceInsights || hasSearchInsights,
    signalsProvided: hasSignals,
    insightsUsed: audienceSignalsUsedCount > 0 || searchSignalsUsedCount > 0,
    signalsUsed: signalsUsedCount > 0,
    evidenceCount: (input.synthesis.evidence || []).length,
    audienceSignalsUsedCount,
    searchSignalsUsedCount,
    signalsUsedCount,
    reasons
  };
}

async function callOpenAiForSynthesis(input: {
  moments: ScoredMoment[];
  insightsDigest: InsightsDigest;
  signalsDigest: SignalsDigest;
  audience?: string;
  brandConstraints?: string;
  corrective?: {
    invalidIds?: string[];
    allowedIds?: string[];
    proofReasons?: string[];
  };
}): Promise<Synthesis> {
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
            name: synthesisJsonSchema.name,
            schema: synthesisJsonSchema.schema,
            strict: true
          }
        }
      })
    },
    {
      timeoutMs: 30_000,
      retries: 2,
      backoffMs: 500
    }
  );

  const payload = await response.json();
  const structured = extractStructuredJson(payload);
  const parsed = SynthesisSchema.safeParse(structured);
  if (!parsed.success) {
    throw new Error(`Structured synthesis validation failed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export async function synthesizeMoments(input: SynthesizeRequest): Promise<{
  synthesis: Synthesis;
  usedMoments: ScoredMoment[];
  proof: SynthesisProof;
}> {
  if (!rangeWithinLimit(input.moments)) {
    throw new Error(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  }

  const usedMoments = topMomentsForSynthesis(input.moments, Boolean(input.includeAll));
  const allowedIds = new Set(usedMoments.map((moment) => moment.id));
  const insightsDigest = buildInsightsDigest(input.insights);
  const signalsDigest = buildSignalsDigest(input.signals);

  let first: Synthesis;
  try {
    first = await callOpenAiForSynthesis({
      moments: usedMoments,
      insightsDigest,
      signalsDigest,
      audience: input.audience,
      brandConstraints: input.brandConstraints
    });
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(`OpenAI call failed: ${error.message}`);
    }
    throw error;
  }

  const normalizedFirst = normalizeEvidencePointers(normalizeSynthesisReferencedIds(first, allowedIds));
  const firstInvalid = invalidReferencedIds(normalizedFirst, allowedIds);
  const firstProof = validateProofOfUse({
    synthesis: normalizedFirst,
    request: input,
    insightsDigest,
    signalsDigest
  });

  if (firstInvalid.length === 0 && firstProof.reasons.length === 0) {
    return { synthesis: normalizedFirst, usedMoments, proof: firstProof };
  }

  const second = await callOpenAiForSynthesis({
    moments: usedMoments,
    insightsDigest,
    signalsDigest,
    audience: input.audience,
    brandConstraints: input.brandConstraints,
    corrective: {
      invalidIds: firstInvalid,
      allowedIds: Array.from(allowedIds),
      proofReasons: firstProof.reasons
    }
  });

  const normalizedSecond = normalizeEvidencePointers(normalizeSynthesisReferencedIds(second, allowedIds));
  const secondInvalid = invalidReferencedIds(normalizedSecond, allowedIds);
  const secondProof = validateProofOfUse({
    synthesis: normalizedSecond,
    request: input,
    insightsDigest,
    signalsDigest
  });

  if (secondInvalid.length > 0) {
    const message = `Invalid moment ids after retry: ${secondInvalid.join(", ")}`;
    const error = new Error(message) as Error & {
      invalidIds?: string[];
      allowedIds?: string[];
    };
    error.invalidIds = secondInvalid;
    error.allowedIds = Array.from(allowedIds);
    throw error;
  }

  if (secondProof.reasons.length > 0) {
    const error = new Error("Proof-of-use requirements were not satisfied after retry.") as Error & {
      proofFailure?: SynthesisProof;
      details?: { reasons: string[] };
    };
    error.proofFailure = secondProof;
    error.details = { reasons: secondProof.reasons };
    throw error;
  }

  return {
    synthesis: normalizedSecond,
    usedMoments,
    proof: secondProof
  };
}
