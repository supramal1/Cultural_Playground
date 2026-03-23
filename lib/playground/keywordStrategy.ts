import type { InsightsPayload } from "@/lib/insights/types";
import { normalize as normalizeForCompare, tokenize } from "@/lib/playground/textUtils";

const ULTRA_GENERIC_TERMS = new Set([
  "music",
  "movie",
  "sport",
  "sports",
  "holiday",
  "holidays",
  "news",
  "brand",
  "audience"
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanKeyword(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }
  const key = normalizeForCompare(normalized);
  if (ULTRA_GENERIC_TERMS.has(key)) {
    return null;
  }
  if (key.length < 2) {
    return null;
  }
  return normalized;
}

function dedupeWithCap(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanKeyword(value);
    if (!cleaned) {
      continue;
    }
    const key = normalizeForCompare(cleaned);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(cleaned);
    if (output.length >= cap) {
      break;
    }
  }

  return output;
}

function parseCsvLike(input?: string[] | string): string[] {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function objectiveTerms(objective?: string): string[] {
  if (!objective) {
    return [];
  }
  return tokenize(objective).filter((token) => token.length >= 3);
}

function brandTerms(brand?: string): string[] {
  if (!brand) {
    return [];
  }
  return tokenize(brand).filter((token) => token.length >= 3);
}

function audienceTerms(audienceKeyword?: string): string[] {
  if (!audienceKeyword) {
    return [];
  }
  return tokenize(audienceKeyword).filter((token) => token.length >= 3);
}

export type KeywordSet = {
  core: string[];
  expansion: string[];
  negative: string[];
  inPlay: string[];
};

export function buildKeywordSet(input: {
  userBoostKeywords?: string[] | string;
  audienceKeyword?: string;
  brand?: string;
  objective?: string;
  exclusions?: string[] | string;
  insights?: InsightsPayload;
  playgroundSeedKeywords?: string[];
}): KeywordSet {
  const userBoost = dedupeWithCap(parseCsvLike(input.userBoostKeywords), 12);
  const exclusion = dedupeWithCap(parseCsvLike(input.exclusions), 10);

  const risingFromSearch = dedupeWithCap(
    [
      ...(input.insights?.search?.queriesLatestMonth.byTrend.fastRising || []).map((item) => item.query),
      ...(input.insights?.search?.queriesLatestMonth.byTrend.top || []).map((item) => item.query)
    ],
    8
  );
  const affinityFromAudience = dedupeWithCap(
    (input.insights?.audience?.topAffinities || []).map((item) => item.item),
    6
  );

  const audience = dedupeWithCap(audienceTerms(input.audienceKeyword), 4);
  const brandObjective = dedupeWithCap(
    [...brandTerms(input.brand), ...objectiveTerms(input.objective)],
    8
  );
  const playgroundSeeds = dedupeWithCap(input.playgroundSeedKeywords || [], 12);

  const core = dedupeWithCap(
    [
      ...userBoost.slice(0, 6),
      ...risingFromSearch.slice(0, 4),
      ...affinityFromAudience.slice(0, 2),
      ...audience.slice(0, 2),
      ...playgroundSeeds.slice(0, 2)
    ],
    12
  );

  const expansion = dedupeWithCap(
    [
      ...risingFromSearch.slice(4),
      ...affinityFromAudience.slice(2),
      ...playgroundSeeds.slice(2),
      ...brandObjective,
      ...audience
    ],
    18
  );

  const negative = dedupeWithCap(
    [...exclusion, ...(input.insights?.search?.derived.negativeKeywords || [])],
    10
  );

  const inPlay = dedupeWithCap([...core, ...expansion], 30);

  return {
    core,
    expansion,
    negative,
    inPlay
  };
}

export function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  const aSet = new Set(a.map(normalizeForCompare));
  const bSet = new Set(b.map(normalizeForCompare));
  // Build a token set from b for stem-level matching
  const bTokens = new Set(b.flatMap((value) => tokenize(value)));
  let matches = 0;
  for (const value of aSet) {
    // Exact match (full weight)
    if (bSet.has(value)) {
      matches += 1;
      continue;
    }
    // Substring containment (full weight)
    let found = false;
    for (const bValue of bSet) {
      if (value.includes(" ") && bValue.includes(value)) {
        found = true;
        break;
      }
      if (bValue.includes(" ") && value.includes(bValue)) {
        found = true;
        break;
      }
    }
    if (found) {
      matches += 1;
      continue;
    }
    // Token-level stem matching (partial weight)
    const aTokens = tokenize(value);
    const stemHits = aTokens.filter((token) => bTokens.has(token)).length;
    if (stemHits > 0) {
      matches += stemHits / aTokens.length;
    }
  }

  // Each match = ~25 points (capped at 100). This means 2 exact matches = 50,
  // 4 matches = 100. More generous than percentage-based scoring because
  // taxonomy keywords are intentionally specific.
  return Math.min(100, Math.round(matches * 25));
}

