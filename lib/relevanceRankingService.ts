import { z } from "zod";
import {
  DEFAULT_OPENAI_MODEL,
  LLM_KEYWORD_MIN_KEEP,
  LLM_KEYWORD_RELEVANCE_MIN,
  LLM_RELEVANCE_MAX_MOMENTS,
  LLM_RELEVANCE_WEIGHT,
  OPENAI_BASE_URL
} from "@/lib/config";
import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import { sortScoredMoments } from "@/lib/scoring";
import type { ScoredMoment } from "@/lib/schemas/moment";

const RelevanceItemSchema = z.object({
  id: z.string().min(1),
  relevance: z.number().min(0).max(100)
});

const RelevanceResponseSchema = z.object({
  items: z.array(RelevanceItemSchema)
});

type RelevanceResponse = z.infer<typeof RelevanceResponseSchema>;

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

function relevanceSystemPrompt(): string {
  return [
    "You rank provided moments by relevance for planning.",
    "Use only provided fields and ids.",
    "Do not invent moments or ids.",
    "Prioritize audience fit and keyword relevance.",
    "Relevance scale is 0-100 where 100 is best fit."
  ].join(" ");
}

function truncate(input: string, length = 220): string {
  return input.length > length ? `${input.slice(0, length)}...` : input;
}

function hasKeywordMatch(moment: ScoredMoment, keywords: string[]): boolean {
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) {
    return true;
  }

  const haystack = [moment.title, moment.subcategory || "", ...moment.tags].join(" ").toLowerCase();
  return normalized.some((keyword) => haystack.includes(keyword));
}

function relevanceUserPrompt(input: {
  moments: ScoredMoment[];
  keywords: string[];
  audience?: string;
  brandConstraints?: string;
}): string {
  const compactMoments = input.moments.map((moment) => ({
    id: moment.id,
    title: moment.title,
    category: moment.category,
    subcategory: moment.subcategory,
    tags: moment.tags,
    description: truncate(moment.description || "")
  }));

  return [
    `Audience: ${input.audience || "General UK audience"}`,
    `Keywords: ${input.keywords.join(", ") || "none"}`,
    `Brand constraints: ${input.brandConstraints || "none"}`,
    "Return relevance scores for these moments:",
    JSON.stringify(compactMoments)
  ].join("\n\n");
}

async function callOpenAiRelevance(input: {
  moments: ScoredMoment[];
  keywords: string[];
  audience?: string;
  brandConstraints?: string;
}): Promise<RelevanceResponse> {
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
            content: [{ type: "input_text", text: relevanceSystemPrompt() }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: relevanceUserPrompt(input) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "moment_relevance_scores",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      relevance: { type: "number", minimum: 0, maximum: 100 }
                    },
                    required: ["id", "relevance"]
                  }
                }
              },
              required: ["items"]
            }
          }
        }
      })
    },
    { timeoutMs: 30_000, retries: 2, backoffMs: 500 }
  );

  const payload = await response.json();
  const structured = extractStructuredJson(payload);
  const parsed = RelevanceResponseSchema.safeParse(structured);
  if (!parsed.success) {
    throw new Error(`Relevance schema validation failed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export async function rerankMomentsWithLlm(input: {
  moments: ScoredMoment[];
  keywords: string[];
  audience?: string;
  brandConstraints?: string;
}): Promise<{ moments: ScoredMoment[]; warning?: string }> {
  if (input.moments.length === 0) {
    return { moments: input.moments };
  }

  const candidateCount = Math.min(LLM_RELEVANCE_MAX_MOMENTS, input.moments.length);
  const candidates = input.moments.slice(0, candidateCount);
  const candidateIds = new Set(candidates.map((moment) => moment.id));

  let relevance: RelevanceResponse;
  try {
    relevance = await callOpenAiRelevance({
      moments: candidates,
      keywords: input.keywords,
      audience: input.audience,
      brandConstraints: input.brandConstraints
    });
  } catch (error) {
    if (error instanceof FetchError) {
      return {
        moments: input.moments,
        warning: `LLM relevance ranking unavailable: ${error.message}`
      };
    }
    return {
      moments: input.moments,
      warning:
        error instanceof Error
          ? `LLM relevance ranking unavailable: ${error.message}`
          : "LLM relevance ranking unavailable."
    };
  }

  const map = new Map<string, number>();
  for (const item of relevance.items) {
    if (!candidateIds.has(item.id)) {
      return {
        moments: input.moments,
        warning: `LLM relevance returned unknown moment id (${item.id}); deterministic ranking kept.`
      };
    }
    map.set(item.id, item.relevance);
  }

  const rescoredCandidates = candidates.map((moment) => {
    const relevanceScore = map.get(moment.id) ?? 0;
    return {
      ...moment,
      score: moment.score + relevanceScore * LLM_RELEVANCE_WEIGHT
    };
  });

  const hasKeywords = input.keywords.some((keyword) => keyword.trim().length > 0);
  if (!hasKeywords) {
    const rescored = [...rescoredCandidates, ...input.moments.slice(candidateCount)];
    return {
      moments: sortScoredMoments(rescored),
      warning: `Applied LLM relevance reranking to top ${candidateCount} moments (keywords + audience aware).`
    };
  }

  const aboveThreshold = rescoredCandidates.filter(
    (moment) => (map.get(moment.id) ?? 0) >= LLM_KEYWORD_RELEVANCE_MIN
  );

  let keptCandidates = aboveThreshold;
  const minimumKeep = Math.min(
    rescoredCandidates.length,
    Math.max(1, Math.min(LLM_KEYWORD_MIN_KEEP, Math.floor(rescoredCandidates.length * 0.4)))
  );
  if (keptCandidates.length < minimumKeep) {
    keptCandidates = [...rescoredCandidates]
      .sort((a, b) => (map.get(b.id) ?? 0) - (map.get(a.id) ?? 0))
      .slice(0, minimumKeep);
  }

  const remaining = input.moments.slice(candidateCount).filter((moment) => hasKeywordMatch(moment, input.keywords));
  const filteredOutCount = input.moments.length - (keptCandidates.length + remaining.length);

  return {
    moments: sortScoredMoments([...keptCandidates, ...remaining]),
    warning:
      `Applied LLM keyword filtering to top ${candidateCount} moments; filtered out ${Math.max(0, filteredOutCount)} lower-relevance moments.`
  };
}
