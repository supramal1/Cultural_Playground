import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry, FetchError } from "@/lib/fetchWithRetry";
import { collectRedditSignals } from "@/lib/signals/providers/reddit";
import { RISK_KEYWORDS, RISK_SUBREDDITS } from "@/lib/playground/riskConfig";
import {
  BrandDiscourseContextSchema,
  brandDiscourseJsonSchema,
  BrandSignalsSchema,
  BrandSignalsRequestSchema,
  type BrandDiscourseContext,
  type BrandSignals,
  type BrandSignalsRequest
} from "@/lib/brandSignals/types";

type BrandSignalsResult = {
  brandSignals: BrandSignals;
  brandDiscourseContext?: BrandDiscourseContext;
  meta: {
    cache: "hit" | "miss";
    skipped: boolean;
    includePerplexity: boolean;
    queriesUsed: string[];
    queryStrategy: {
      phaseA: {
        redditQueries: string[];
        redditQueryCap: number;
        redditPostCap: number;
        perplexityAttempted: boolean;
      };
    };
    warnings: string[];
  };
};

const PERPLEXITY_BASE_URL = process.env.PERPLEXITY_BASE_URL || "https://api.perplexity.ai";
const DEFAULT_PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar";

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toToken(value: string): string {
  return normalize(value).toLowerCase();
}

function dedupe(values: string[], cap: number): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = normalize(raw);
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(value);
    if (output.length >= cap) {
      break;
    }
  }
  return output;
}

function tokenize(value: string): string[] {
  return toToken(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .filter((token) => token.length >= 3)
    .map((token) => (token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token));
}

function buildBrandQueries(input: {
  brand: string;
  objective?: string;
  audienceKeyword: string;
}): string[] {
  const queries = [input.brand];

  const objectiveToken = tokenize(input.objective || "").find(
    (token) => !["brand", "campaign", "objective", "awareness", "consideration", "conversion"].includes(token)
  );

  if (objectiveToken) {
    queries.push(`${input.brand} ${objectiveToken}`);
  }

  if (normalize(input.audienceKeyword)) {
    queries.push(`${input.brand} ${normalize(input.audienceKeyword)}`);
  }

  return dedupe(queries, 3);
}

function extractSources(payload: unknown): Array<{ title: string; url: string }> {
  const sources: Array<{ title: string; url: string }> = [];
  if (!payload || typeof payload !== "object") {
    return sources;
  }

  const asAny = payload as { citations?: unknown; search_results?: unknown };

  const push = (title: string, url: string): void => {
    try {
      const normalized = new URL(url).toString();
      sources.push({ title: normalize(title) || "Source", url: normalized });
    } catch {
      // ignore invalid url
    }
  };

  if (Array.isArray(asAny.citations)) {
    for (const citation of asAny.citations) {
      if (typeof citation === "string") {
        push("Source", citation);
        continue;
      }
      if (citation && typeof citation === "object") {
        const typed = citation as { title?: unknown; url?: unknown };
        if (typeof typed.url === "string") {
          push(typeof typed.title === "string" ? typed.title : "Source", typed.url);
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
      if (typeof typed.url === "string") {
        push(typeof typed.title === "string" ? typed.title : "Source", typed.url);
      }
    }
  }

  return dedupe(
    sources.map((item) => JSON.stringify(item)),
    8
  ).map((item) => JSON.parse(item) as { title: string; url: string });
}

function parsePerplexityJson(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("Perplexity payload malformed.");
  }
  const asAny = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = asAny.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Perplexity response content missing.");
  }

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Perplexity response was not valid JSON.");
  }
}

async function fetchBrandDiscourseContext(input: {
  brand: string;
  objective?: string;
  audienceKeyword: string;
}): Promise<{ context?: BrandDiscourseContext; warnings: string[] }> {
  const warnings: string[] = [];
  if (!process.env.PERPLEXITY_API_KEY) {
    warnings.push("Perplexity disabled: PERPLEXITY_API_KEY missing.");
    return { warnings };
  }

  const prompt = [
    `Brand: ${input.brand}`,
    `Objective: ${input.objective || "Not provided"}`,
    `Audience: ${input.audienceKeyword}`,
    "Summarize how this brand is discussed in the UK recently.",
    "Return: narratives (positive/neutral/negative), misconceptions, safety notes, and citations.",
    "Use concise, planning-safe language."
  ].join("\n");

  try {
    const response = await fetchWithRetry(
      `${PERPLEXITY_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: DEFAULT_PERPLEXITY_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a media planning analyst. Return strict JSON only with cited sources."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              schema: brandDiscourseJsonSchema.schema
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
    const parsed = parsePerplexityJson(payload);
    const parsedObject =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const context = BrandDiscourseContextSchema.parse({
      ...parsedObject,
      citations: extractSources(payload)
    });
    return { context, warnings };
  } catch (error) {
    if (error instanceof FetchError) {
      warnings.push(`Perplexity brand discourse failed: ${error.message}`);
      return { warnings };
    }
    warnings.push(error instanceof Error ? error.message : "Perplexity brand discourse failed.");
    return { warnings };
  }
}

function detectBrandRisks(input: { keywords: string[]; subreddits: string[]; titles: string[] }): string[] {
  const keywordText = toToken(input.keywords.join(" "));
  const titleText = toToken(input.titles.join(" "));
  const subs = new Set(input.subreddits.map((item) => toToken(item)));
  const flags = new Set<string>();

  for (const rule of RISK_KEYWORDS) {
    const hit = rule.terms.some((term) => {
      const candidate = toToken(term);
      return keywordText.includes(candidate) || titleText.includes(candidate);
    });
    if (hit) {
      flags.add(rule.flag);
    }
  }

  for (const rule of RISK_SUBREDDITS) {
    if (rule.names.some((name) => subs.has(toToken(name)))) {
      flags.add(rule.flag);
    }
  }

  return Array.from(flags);
}

function deterministicThemeKeywords(input: { titles: string[]; subredditNames: string[]; commonThemes: string[] }): {
  themes: string[];
  adjacency: string[];
} {
  const counts = new Map<string, number>();

  const add = (value: string, weight: number): void => {
    for (const token of tokenize(value)) {
      counts.set(token, (counts.get(token) || 0) + weight);
    }
  };

  input.commonThemes.forEach((item) => add(item, 3));
  input.subredditNames.forEach((item) => add(item, 2));
  input.titles.forEach((item) => add(item, 1));

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  return {
    themes: dedupe([...input.commonThemes, ...sorted], 12),
    adjacency: dedupe([...sorted, ...input.commonThemes], 20)
  };
}

export async function generateBrandSignals(input: BrandSignalsRequest): Promise<BrandSignalsResult> {
  const parsed = BrandSignalsRequestSchema.parse(input);
  const includePerplexity = parsed.options?.includePerplexity !== false;
  const brand = normalize(parsed.brief.brand || "");

  if (!brand) {
    const emptySignals = BrandSignalsSchema.parse({
      brandThemes: [],
      brandAdjacencyKeywords: [],
      brandSubreddits: [],
      brandRiskFlags: [],
      queriesUsed: [],
      queryDiagnostics: [],
      evidencePointers: [],
      warnings: ["Brand missing: brand discourse phase skipped."]
    });

    return {
      brandSignals: emptySignals,
      meta: {
        cache: "miss",
        skipped: true,
        includePerplexity,
        queriesUsed: [],
        queryStrategy: {
          phaseA: {
            redditQueries: [],
            redditQueryCap: 3,
            redditPostCap: 15,
            perplexityAttempted: false
          }
        },
        warnings: ["Brand missing: brand discourse phase skipped."]
      }
    };
  }

  const queries = buildBrandQueries({
    brand,
    objective: parsed.brief.objective,
    audienceKeyword: parsed.brief.audienceKeyword
  });

  const { payload, cache } = await withConnectorCache({
    connector: "brand-signals-v3",
    params: {
      brand,
      objective: parsed.brief.objective || "",
      audience: parsed.brief.audienceKeyword,
      from: parsed.brief.from,
      to: parsed.brief.to,
      keywordSet: parsed.keywordSet || null,
      includePerplexity,
      queries
    },
    keyPresent: true,
    forceRefresh: Boolean(parsed.options?.refresh),
    fetcher: async () => {
      const warnings: string[] = [];
      const queryDiagnostics: BrandSignals["queryDiagnostics"] = [];
      const allPosts: Array<{ title: string; subreddit: string; url: string }> = [];
      const subredditCounts = new Map<string, number>();
      const mergedThemes: string[] = [];

      for (const query of queries) {
        try {
          const reddit = await collectRedditSignals({
            keywords: [query],
            audience: parsed.brief.audienceKeyword,
            from: parsed.brief.from,
            to: parsed.brief.to
          });

          warnings.push(...reddit.warnings.map((warning) => `reddit:${query}: ${warning}`));
          const posts = (reddit.data?.topPosts || []).slice(0, 5);
          posts.forEach((post) => allPosts.push({ title: post.title, subreddit: post.subreddit, url: post.url }));
          (reddit.data?.subredditCandidates || []).forEach((sub) => {
            subredditCounts.set(sub.name, (subredditCounts.get(sub.name) || 0) + 1);
          });
          mergedThemes.push(...(reddit.data?.commonThemes || []));

          queryDiagnostics.push({
            query,
            status: reddit.data ? "OK" : "FAILED",
            postCount: posts.length,
            subredditCount: (reddit.data?.subredditCandidates || []).length,
            message: reddit.warnings[0]
          });
        } catch (error) {
          queryDiagnostics.push({
            query,
            status: "FAILED",
            postCount: 0,
            subredditCount: 0,
            message: error instanceof Error ? error.message : "Reddit query failed"
          });
          warnings.push(
            `reddit:${query}: ${error instanceof Error ? error.message : "Reddit query failed"}`
          );
        }
      }

      const topPosts = allPosts.slice(0, 15);
      const subredditNames = Array.from(subredditCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name)
        .slice(0, 5);

      const keywordSeed = [
        ...(parsed.keywordSet?.core || []),
        ...(parsed.keywordSet?.expansion || []),
        ...(parsed.brief.boostKeywords || [])
      ];

      const inferred = deterministicThemeKeywords({
        titles: topPosts.map((item) => item.title),
        subredditNames,
        commonThemes: mergedThemes
      });

      const brandThemes = dedupe(inferred.themes, 12);
      const brandAdjacencyKeywords = dedupe(
        [...inferred.adjacency, ...keywordSeed, ...brandThemes],
        20
      );
      const brandRiskFlags = detectBrandRisks({
        keywords: [brand, ...brandAdjacencyKeywords],
        subreddits: subredditNames,
        titles: topPosts.map((item) => item.title)
      });

      let brandDiscourseContext: BrandDiscourseContext | undefined;
      if (includePerplexity) {
        const perplexity = await fetchBrandDiscourseContext({
          brand,
          objective: parsed.brief.objective,
          audienceKeyword: parsed.brief.audienceKeyword
        });
        warnings.push(...perplexity.warnings);
        brandDiscourseContext = perplexity.context;
      }

      const evidencePointers = dedupe(
        [
          ...brandThemes.map((_item, index) => `brandSignals.brandThemes[${index}]`),
          ...brandAdjacencyKeywords.map(
            (_item, index) => `brandSignals.brandAdjacencyKeywords[${index}]`
          ),
          ...subredditNames.map((_item, index) => `brandSignals.brandSubreddits[${index}]`),
          ...queries.map((_item, index) => `brandSignals.queryDiagnostics[${index}]`),
          ...(brandDiscourseContext?.narratives.positive || []).map(
            (_item, index) => `brandDiscourseContext.narratives.positive[${index}]`
          ),
          ...(brandDiscourseContext?.narratives.neutral || []).map(
            (_item, index) => `brandDiscourseContext.narratives.neutral[${index}]`
          ),
          ...(brandDiscourseContext?.narratives.negative || []).map(
            (_item, index) => `brandDiscourseContext.narratives.negative[${index}]`
          )
        ],
        40
      );

      const brandSignals = BrandSignalsSchema.parse({
        brandThemes,
        brandAdjacencyKeywords,
        brandSubreddits: subredditNames,
        brandRiskFlags,
        queriesUsed: queries,
        queryDiagnostics,
        evidencePointers,
        warnings: dedupe(warnings, 30)
      });

      return {
        brandSignals,
        brandDiscourseContext
      };
    }
  });

  return {
    brandSignals: payload.brandSignals,
    brandDiscourseContext: payload.brandDiscourseContext,
    meta: {
      cache,
      skipped: false,
      includePerplexity,
      queriesUsed: payload.brandSignals.queriesUsed,
      queryStrategy: {
        phaseA: {
          redditQueries: payload.brandSignals.queriesUsed,
          redditQueryCap: 3,
          redditPostCap: 15,
          perplexityAttempted: includePerplexity && Boolean(process.env.PERPLEXITY_API_KEY)
        }
      },
      warnings: payload.brandSignals.warnings
    }
  };
}
