import type {
  AudienceInsightsNormalized,
  SearchInsightsNormalized
} from "@/lib/insights/types";

type AudienceAffinityRow = AudienceInsightsNormalized["topAffinities"][number];

const DEFAULT_AUDIENCE_KEYWORD_CAP = 25;
const DEFAULT_SEARCH_KEYWORD_CAP = 25;
const DEFAULT_COMBINED_KEYWORD_CAP = 40;

const STOPWORDS = new Set([
  "n/a",
  "na",
  "indexed volume",
  "none",
  "unknown",
  "all",
  "anyone",
  "audience"
]);

function canonicalizeKeyword(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-&']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized;
}

export function cleanKeyword(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const canonical = canonicalizeKeyword(trimmed);
  if (!canonical || STOPWORDS.has(canonical)) {
    return null;
  }
  if (canonical.length < 2) {
    return null;
  }
  return trimmed.replace(/\s+/g, " ").trim();
}

function dedupeKeywords(values: string[], cap: number): string[] {
  const byCanonical = new Map<string, string>();
  for (const raw of values) {
    const cleaned = cleanKeyword(raw);
    if (!cleaned) {
      continue;
    }
    const canonical = canonicalizeKeyword(cleaned);
    if (!byCanonical.has(canonical)) {
      byCanonical.set(canonical, cleaned);
    }
    if (byCanonical.size >= cap) {
      break;
    }
  }
  return Array.from(byCanonical.values());
}

export function deriveAudienceSeedKeywords(
  affinities: AudienceAffinityRow[],
  cap = DEFAULT_AUDIENCE_KEYWORD_CAP
): string[] {
  const ranked = [...affinities].sort((a, b) => {
    const relevanceDiff = (b.relevance ?? Number.NEGATIVE_INFINITY) - (a.relevance ?? Number.NEGATIVE_INFINITY);
    if (relevanceDiff !== 0) {
      return relevanceDiff;
    }
    const indexDiff = (b.index ?? Number.NEGATIVE_INFINITY) - (a.index ?? Number.NEGATIVE_INFINITY);
    if (indexDiff !== 0) {
      return indexDiff;
    }
    return (b.share ?? Number.NEGATIVE_INFINITY) - (a.share ?? Number.NEGATIVE_INFINITY);
  });

  return dedupeKeywords(
    ranked.map((row) => row.item),
    cap
  );
}

export function deriveSearchSeedKeywords(
  search: SearchInsightsNormalized["queriesLatestMonth"]["byTrend"],
  cap = DEFAULT_SEARCH_KEYWORD_CAP
): string[] {
  const merged = [
    ...search.top,
    ...search.fastRising,
    ...search.sustainedGrowth,
    ...search.emerging
  ];

  return dedupeKeywords(
    merged.map((row) => row.query),
    cap
  );
}

export function combineKeywordSets(input: {
  userKeywords: string[];
  insightsKeywords?: string[];
  audienceKeywords?: string[];
  searchKeywords?: string[];
  cap?: number;
}): {
  combined: string[];
  userCount: number;
  insightsCount: number;
} {
  const cap = input.cap ?? DEFAULT_COMBINED_KEYWORD_CAP;
  const userCleaned = dedupeKeywords(input.userKeywords, cap);
  const insightsRaw = [
    ...(input.insightsKeywords || []),
    ...(input.audienceKeywords || []),
    ...(input.searchKeywords || [])
  ];
  const insightsCleaned = dedupeKeywords(insightsRaw, cap);

  const combined = dedupeKeywords([...userCleaned, ...insightsCleaned], cap);
  const userCanonical = new Set(userCleaned.map(canonicalizeKeyword));
  const insightsCount = combined.filter((keyword) => !userCanonical.has(canonicalizeKeyword(keyword))).length;

  return {
    combined,
    userCount: userCleaned.length,
    insightsCount
  };
}
