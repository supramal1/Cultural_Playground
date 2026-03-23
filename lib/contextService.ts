import { z } from "zod";
import { MAX_DATE_RANGE_DAYS } from "@/lib/config";
import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import {
  ExternalContextSchema,
  externalContextJsonSchema,
  type ExternalContext
} from "@/lib/schemas/context";
import { ScoredMomentSchema, type ScoredMoment } from "@/lib/schemas/moment";
import { SynthesisSchema, type Synthesis } from "@/lib/schemas/synthesis";
import { InsightsPayloadSchema, type InsightsPayload } from "@/lib/insights/types";
import { SignalsBundleSchema, type SignalsBundle } from "@/lib/signals/types";

const DEFAULT_PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar";
const PERPLEXITY_BASE_URL = process.env.PERPLEXITY_BASE_URL || "https://api.perplexity.ai";
const CONTEXT_TOP_N = 40;

export type ContextSource = {
  title: string;
  url: string;
};

export const ContextRequestSchema = z.object({
  moments: z.array(ScoredMomentSchema).min(1),
  synthesis: SynthesisSchema.optional(),
  insights: InsightsPayloadSchema.optional(),
  signals: SignalsBundleSchema.optional(),
  brand: z.string().optional(),
  audience: z.string().optional(),
  brandConstraints: z.string().optional(),
  includeAll: z.boolean().optional().default(false)
});

export type ContextRequest = z.infer<typeof ContextRequestSchema>;

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

function topMomentsForContext(moments: ScoredMoment[], includeAll: boolean): ScoredMoment[] {
  if (includeAll) {
    return moments;
  }

  return [...moments].sort((a, b) => b.score - a.score).slice(0, CONTEXT_TOP_N);
}

function truncate(input: string, length = 220): string {
  return input.length > length ? `${input.slice(0, length)}...` : input;
}

function systemPrompt(): string {
  return [
    "You are an analyst providing external cultural context for media planners.",
    "Use web-grounded reasoning from your retrieval system and return JSON only.",
    "Do not restate source moments as factual claims; keep language generic and strategic.",
    "Avoid dates, times, venues, opponent names, and event titles in prose.",
    "Focus on practical so-what implications for brand and audience planning."
  ].join(" ");
}

function userPrompt(input: {
  moments: ScoredMoment[];
  synthesis?: Synthesis;
  insights?: InsightsPayload;
  signals?: SignalsBundle;
  brand?: string;
  audience?: string;
  brandConstraints?: string;
}): string {
  const compactMoments = input.moments.map((moment) => ({
    id: moment.id,
    category: moment.category,
    subcategory: moment.subcategory,
    tags: moment.tags,
    description: truncate(moment.description || "")
  }));

  const synthesisDigest = input.synthesis
    ? {
        execSummary: input.synthesis.execSummary,
        planningImplications: input.synthesis.planningImplications.slice(0, 4),
        themes: input.synthesis.themes.slice(0, 5).map((theme) => ({
          id: theme.id,
          title: theme.title,
          whyThisMatters: theme.whyThisMatters,
          channels: theme.channels.slice(0, 4),
          risks: theme.risks.slice(0, 2),
          momentIds: theme.momentIds
        }))
      }
    : null;

  const insightsDigest = input.insights
    ? {
        audience: input.insights.audience
          ? {
              meta: input.insights.audience.meta,
              topAffinities: input.insights.audience.topAffinities.slice(0, 6)
            }
          : undefined,
        search: input.insights.search
          ? {
              meta: input.insights.search.meta,
              latestMonth: input.insights.search.queriesLatestMonth
            }
          : undefined
      }
    : null;

  const signalsDigest = input.signals
    ? {
        googleTrends: input.signals.googleTrends
          ? {
              topRelatedQueries: input.signals.googleTrends.topRelatedQueries.slice(0, 8),
              topRelatedTopics: input.signals.googleTrends.topRelatedTopics.slice(0, 8)
            }
          : undefined,
        reddit: input.signals.reddit
          ? {
              subredditCandidates: input.signals.reddit.subredditCandidates.slice(0, 4),
              topPosts: input.signals.reddit.topPosts.slice(0, 4),
              commonThemes: input.signals.reddit.commonThemes.slice(0, 6)
            }
          : undefined,
        wikimedia: input.signals.wikimedia
          ? {
              entities: input.signals.wikimedia.entities.slice(0, 5).map((entity) => ({
                title: entity.title,
                total: entity.total
              }))
            }
          : undefined
      }
    : null;

  const querySeeds = buildContextQuerySeeds({
    brand: input.brand,
    audience: input.audience,
    synthesis: input.synthesis,
    insights: input.insights,
    signals: input.signals
  });

  return [
    `Brand: ${input.brand || "Not provided"}`,
    `Audience: ${input.audience || "General UK audience"}`,
    `Brand constraints: ${input.brandConstraints || "None provided"}`,
    "Moment signals (ids + categories/tags only):",
    JSON.stringify(compactMoments),
    `Query seeds (max 8): ${JSON.stringify(querySeeds)}`,
    synthesisDigest
      ? `Existing planning synthesis (for context refinement):\n${JSON.stringify(synthesisDigest)}`
      : "Existing planning synthesis: not provided",
    insightsDigest ? `Insights JSON:\n${JSON.stringify(insightsDigest)}` : "Insights JSON: not provided",
    signalsDigest ? `Signals JSON:\n${JSON.stringify(signalsDigest)}` : "Signals JSON: not provided"
  ].join("\n\n");
}

export function buildContextQuerySeeds(input: {
  brand?: string;
  audience?: string;
  synthesis?: Synthesis;
  insights?: InsightsPayload;
  signals?: SignalsBundle;
}): string[] {
  const candidates: string[] = [];

  if (input.brand?.trim()) {
    candidates.push(input.brand.trim());
  }
  if (input.audience?.trim()) {
    candidates.push(input.audience.trim());
  }

  if (input.synthesis) {
    candidates.push(...input.synthesis.themes.slice(0, 3).map((theme) => theme.title));
  }

  if (input.insights?.audience) {
    candidates.push(...input.insights.audience.topAffinities.slice(0, 3).map((row) => row.item));
  }
  if (input.insights?.search) {
    candidates.push(
      ...input.insights.search.queriesLatestMonth.byTrend.fastRising.slice(0, 3).map((row) => row.query)
    );
  }

  if (input.signals?.googleTrends) {
    candidates.push(...input.signals.googleTrends.topRelatedQueries.slice(0, 2).map((row) => row.query));
  }
  if (input.signals?.reddit) {
    candidates.push(...input.signals.reddit.subredditCandidates.slice(0, 2).map((row) => row.name));
    candidates.push(...input.signals.reddit.commonThemes.slice(0, 2));
  }
  if (input.signals?.wikimedia) {
    candidates.push(...input.signals.wikimedia.entities.slice(0, 2).map((entity) => entity.title));
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
    if (deduped.length >= 8) {
      break;
    }
  }
  return deduped;
}

function parseStructuredContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Perplexity response content was empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Perplexity response did not contain valid JSON.");
  }
}

function normalizeUrl(url: string): string | null {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

function extractSources(payload: unknown): ContextSource[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const asAny = payload as {
    citations?: unknown;
    search_results?: unknown;
  };

  const candidates: ContextSource[] = [];

  if (Array.isArray(asAny.citations)) {
    for (const item of asAny.citations) {
      if (typeof item === "string") {
        const normalized = normalizeUrl(item);
        if (normalized) {
          candidates.push({ title: "Source", url: normalized });
        }
        continue;
      }

      if (item && typeof item === "object") {
        const typed = item as { title?: unknown; url?: unknown };
        if (typeof typed.url === "string") {
          const normalized = normalizeUrl(typed.url);
          if (normalized) {
            candidates.push({
              title:
                typeof typed.title === "string" && typed.title.trim()
                  ? typed.title.trim()
                  : "Source",
              url: normalized
            });
          }
        }
      }
    }
  }

  if (Array.isArray(asAny.search_results)) {
    for (const item of asAny.search_results) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const typed = item as { title?: unknown; url?: unknown };
      if (typeof typed.url !== "string") {
        continue;
      }
      const normalized = normalizeUrl(typed.url);
      if (!normalized) {
        continue;
      }
      candidates.push({
        title:
          typeof typed.title === "string" && typed.title.trim()
            ? typed.title.trim()
            : "Source",
        url: normalized
      });
    }
  }

  const deduped = new Map<string, ContextSource>();
  for (const source of candidates) {
    if (!deduped.has(source.url)) {
      deduped.set(source.url, source);
    }
  }

  return Array.from(deduped.values()).slice(0, 8);
}

function extractStructuredContext(payload: unknown): ExternalContext {
  if (!payload || typeof payload !== "object") {
    throw new Error("Perplexity response payload malformed.");
  }

  const asAny = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = asAny.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Perplexity response did not include completion content.");
  }

  const parsedJson = parseStructuredContent(content);
  const parsed = ExternalContextSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Context schema validation failed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

async function callPerplexity(input: {
  moments: ScoredMoment[];
  synthesis?: Synthesis;
  insights?: InsightsPayload;
  signals?: SignalsBundle;
  brand?: string;
  audience?: string;
  brandConstraints?: string;
}): Promise<{ context: ExternalContext; sources: ContextSource[] }> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY missing");
  }

  const response = await fetchWithRetry(
    `${PERPLEXITY_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.PERPLEXITY_MODEL || DEFAULT_PERPLEXITY_MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt()
          },
          {
            role: "user",
            content: userPrompt(input)
          }
        ],
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: externalContextJsonSchema.schema
          }
        }
      })
    },
    {
      timeoutMs: 45_000,
      retries: 2,
      backoffMs: 500
    }
  );

  const payload = await response.json();
  return {
    context: extractStructuredContext(payload),
    sources: extractSources(payload)
  };
}

export async function generateExternalContext(input: ContextRequest): Promise<{
  context: ExternalContext;
  sources: ContextSource[];
  usedMoments: ScoredMoment[];
}> {
  if (!rangeWithinLimit(input.moments)) {
    throw new Error(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  }

  const usedMoments = topMomentsForContext(input.moments, Boolean(input.includeAll));

  try {
    const result = await callPerplexity({
      moments: usedMoments,
      synthesis: input.synthesis,
      insights: input.insights,
      signals: input.signals,
      brand: input.brand,
      audience: input.audience,
      brandConstraints: input.brandConstraints
    });
    return {
      context: result.context,
      sources: result.sources,
      usedMoments
    };
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(`Perplexity call failed: ${error.message}`);
    }
    throw error;
  }
}
