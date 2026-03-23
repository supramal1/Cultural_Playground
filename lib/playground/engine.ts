import { withConnectorCache } from "@/lib/cache";
import { collectMoments } from "@/lib/momentsService";
import { buildKeywordSet, overlapScore } from "@/lib/playground/keywordStrategy";
import { PLAYGROUND_TAXONOMY } from "@/lib/playground/taxonomy";
import { RISK_KEYWORDS, RISK_SUBREDDITS } from "@/lib/playground/riskConfig";
import { generateBrandSignals } from "@/lib/brandSignals/service";
import { normalize, tokenize } from "@/lib/playground/textUtils";
import {
  PlanDataSchema,
  PlaygroundCandidateSchema,
  type PlanData,
  type PlanDataRequest,
  type MomentCategory,
  type PlaygroundCandidate,
  type PlaygroundDiscoveryRequest
} from "@/lib/playground/types";
import { generateSignals } from "@/lib/signals/service";
import { collectWikimediaSignals } from "@/lib/signals/providers/wikimedia";

function clamp(input: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, input));
}

function dedupe(values: string[], cap = 60): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalize(normalized);
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

function tokenizeSet(values: string[]): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    for (const token of tokenize(value)) {
      set.add(token);
    }
  }
  return set;
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeTrendValue(value: unknown): number {
  const numeric = safeNumber(value);
  if (numeric <= 0) {
    return 0;
  }
  // Google Trends "Breakout" values are often represented as 5000.
  // Clamp those to 100 so they don't dominate every candidate.
  if (numeric >= 5000) {
    return 100;
  }
  return clamp(Math.round(numeric), 0, 100);
}

function seasonFromMonth(month: number): "winter" | "spring" | "summer" | "autumn" {
  if (month === 12 || month <= 2) {
    return "winter";
  }
  if (month >= 3 && month <= 5) {
    return "spring";
  }
  if (month >= 6 && month <= 8) {
    return "summer";
  }
  return "autumn";
}

function midpointMonth(input: { from: string; to: string }): number {
  const fromMs = new Date(`${input.from}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${input.to}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return new Date().getUTCMonth() + 1;
  }
  const midpoint = new Date((fromMs + toMs) / 2);
  return midpoint.getUTCMonth() + 1;
}

const CATEGORY_BASELINES: Record<MomentCategory, { demand: number; conversation: number }> = {
  sports: { demand: 44, conversation: 43 },
  film: { demand: 40, conversation: 38 },
  holidays: { demand: 48, conversation: 32 },
  events: { demand: 42, conversation: 36 }
};

const SEASONAL_BASELINE_ADJUST: Record<
  "winter" | "spring" | "summer" | "autumn",
  { demand: number; conversation: number }
> = {
  winter: { demand: 6, conversation: 4 },
  spring: { demand: 2, conversation: 1 },
  summer: { demand: -1, conversation: 2 },
  autumn: { demand: 4, conversation: 3 }
};

function baselineLabel(
  score: number,
  normal: number,
  high: number
): "below-normal" | "normal" | "above-normal" | "high" {
  if (score >= high) {
    return "high";
  }
  if (score >= normal + 8) {
    return "above-normal";
  }
  if (score >= normal - 8) {
    return "normal";
  }
  return "below-normal";
}

function buildCategoryBaseline(input: {
  candidate: PlaygroundCandidate;
  from: string;
  to: string;
  demandScore: number;
  conversationScore: number;
}): PlaygroundCandidate["categoryBaseline"] {
  const primaryCategory = input.candidate.recommendedCategories[0] || "events";
  const season = seasonFromMonth(midpointMonth({ from: input.from, to: input.to }));
  const base = CATEGORY_BASELINES[primaryCategory];
  const seasonalAdjust = SEASONAL_BASELINE_ADJUST[season];

  const demandNormal = clamp(Math.round(base.demand + seasonalAdjust.demand), 10, 90);
  const conversationNormal = clamp(Math.round(base.conversation + seasonalAdjust.conversation), 10, 90);
  const demandHigh = clamp(demandNormal + 18, 15, 98);
  const conversationHigh = clamp(conversationNormal + 16, 15, 98);

  return {
    primaryCategory,
    season,
    demandNormal,
    demandHigh,
    conversationNormal,
    conversationHigh,
    demandDelta: Math.round(input.demandScore - demandNormal),
    conversationDelta: Math.round(input.conversationScore - conversationNormal),
    demandLabel: baselineLabel(input.demandScore, demandNormal, demandHigh),
    conversationLabel: baselineLabel(
      input.conversationScore,
      conversationNormal,
      conversationHigh
    )
  };
}

function coerceIsoDate(value: string): string | null {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function buildEvidenceQa(input: {
  candidate: PlaygroundCandidate;
  google?: {
    topRelatedQueries: Array<{ type: "rising" | "top"; value?: number | null }>;
    topRelatedTopics: Array<{ type: "rising" | "top" }>;
    interestOverTime: Array<{ date: string }>;
  };
  reddit?: {
    topPosts: Array<{ comments?: number | null; score?: number | null; createdUtc?: number | null }>;
    commonThemes: string[];
    subredditCandidates: Array<{ name: string }>;
  };
  evidencePointers: string[];
  generatedAt: string;
}): PlaygroundCandidate["evidenceQa"] {
  const trendsRisingQueries = (input.google?.topRelatedQueries || []).filter(
    (item) => item.type === "rising"
  ).length;
  const trendsRisingTopics = (input.google?.topRelatedTopics || []).filter(
    (item) => item.type === "rising"
  ).length;
  const redditPosts = input.reddit?.topPosts.length || 0;
  const redditThemes = input.reddit?.commonThemes.length || 0;
  const redditSubreddits = input.reddit?.subredditCandidates.length || 0;
  const totalSignals =
    trendsRisingQueries +
    trendsRisingTopics +
    redditPosts +
    redditThemes +
    redditSubreddits;

  const candidateTimestamps: number[] = [];
  for (const point of input.google?.interestOverTime || []) {
    const ms = Date.parse(`${point.date}T00:00:00.000Z`);
    if (Number.isFinite(ms)) {
      candidateTimestamps.push(ms);
    }
  }
  for (const post of input.reddit?.topPosts || []) {
    const createdUtc = safeNumber(post.createdUtc);
    if (createdUtc > 0) {
      candidateTimestamps.push(createdUtc * 1000);
    }
  }

  const newestMs =
    candidateTimestamps.length > 0 ? Math.max(...candidateTimestamps) : null;
  const oldestMs =
    candidateTimestamps.length > 0 ? Math.min(...candidateTimestamps) : null;
  const generatedAtIso = coerceIsoDate(input.generatedAt) || new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAtIso);
  const freshnessReferenceMs =
    newestMs ?? (Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now());
  const ageHours = Math.max(
    0,
    Math.round(((Date.now() - freshnessReferenceMs) / (1000 * 60 * 60)) * 10) / 10
  );

  const sourcesCount = (input.google ? 1 : 0) + (input.reddit ? 1 : 0);
  let confidenceScore = 0;
  if (sourcesCount === 2) {
    confidenceScore += 2;
  } else if (sourcesCount === 1) {
    confidenceScore += 1;
  }
  if (totalSignals >= 8) {
    confidenceScore += 2;
  } else if (totalSignals >= 4) {
    confidenceScore += 1;
  } else if (totalSignals <= 2) {
    confidenceScore -= 1;
  }
  if (input.evidencePointers.length >= 4) {
    confidenceScore += 1;
  } else if (input.evidencePointers.length <= 1) {
    confidenceScore -= 1;
  }
  if (ageHours <= 72) {
    confidenceScore += 1;
  } else if (ageHours > 336) {
    confidenceScore -= 1;
  }
  if (input.candidate.fitScore >= 55) {
    confidenceScore += 1;
  }

  const confidenceBand =
    confidenceScore >= 5 ? "high" : confidenceScore >= 3 ? "medium" : "low";

  const rationale = dedupe(
    [
      sourcesCount === 2
        ? "Both demand and conversation sources are available."
        : "Only one primary source is available.",
      `Sample size: ${totalSignals} signal points.`,
      ageHours <= 72
        ? `Signals are fresh (${ageHours}h since newest datapoint).`
        : `Signals are older (${ageHours}h since newest datapoint).`,
      input.evidencePointers.length >= 4
        ? "Evidence coverage is broad enough for planner use."
        : "Evidence coverage is thin; validate manually before activation."
    ],
    4
  );

  return {
    confidenceBand,
    sampleSize: {
      trendsRisingQueries,
      trendsRisingTopics,
      redditPosts,
      redditThemes,
      redditSubreddits,
      evidencePointers: input.evidencePointers.length,
      totalSignals
    },
    freshness: {
      generatedAt: generatedAtIso,
      newestSignalAt: newestMs ? new Date(newestMs).toISOString() : null,
      oldestSignalAt: oldestMs ? new Date(oldestMs).toISOString() : null,
      ageHours
    },
    rationale
  };
}

function selectCandidateQueryTerms(candidate: PlaygroundCandidate): string[] {
  const taxonomySeeds =
    PLAYGROUND_TAXONOMY.find((item) => item.id === candidate.id)?.seedKeywords || [];

  const candidateSpecific = dedupe(
    [...taxonomySeeds, ...candidate.keywords.core, ...candidate.keywords.expansion],
    10
  );

  const terms = candidateSpecific.slice(0, 2);
  if (terms.length > 0) {
    return terms;
  }
  return candidate.keywords.core.slice(0, 2);
}

function scoreDemand(candidate: PlaygroundCandidate): number {
  const risingValues = candidate.evidencePointers.filter((pointer) =>
    pointer.includes("googleTrends.topRelatedQueries")
  ).length;
  return clamp(Math.round(candidate.demandScore || risingValues * 12), 0, 100);
}

function scoreConversation(candidate: PlaygroundCandidate): number {
  const redditPointerCount = candidate.evidencePointers.filter((pointer) =>
    pointer.includes("reddit")
  ).length;
  return clamp(Math.round(candidate.conversationScore || redditPointerCount * 10), 0, 100);
}

function buildWhyNow(input: { demandScore: number; conversationScore: number }): string {
  if (input.demandScore >= 60 && input.conversationScore >= 60) {
    return "Demand and conversation are both active, creating a timely planning window.";
  }
  if (input.demandScore >= input.conversationScore) {
    return "Search demand is leading, indicating emerging intent that can be converted.";
  }
  if (input.conversationScore > input.demandScore) {
    return "Conversation velocity is stronger than search, signalling social momentum.";
  }
  return "Baseline overlap is present, but evidence is still forming.";
}

function detectRiskFlags(input: {
  keywords: string[];
  subredditNames: string[];
  redditTitles: string[];
}): { flags: string[]; notes: string[] } {
  const joinedKeywords = normalize(input.keywords.join(" "));
  const joinedTitles = normalize(input.redditTitles.join(" "));
  const subredditSet = new Set(input.subredditNames.map((name) => normalize(name)));
  const flags = new Set<string>();
  const notes: string[] = [];

  for (const config of RISK_KEYWORDS) {
    if (config.terms.some((term) => joinedKeywords.includes(normalize(term)) || joinedTitles.includes(normalize(term)))) {
      flags.add(config.flag);
    }
  }

  for (const config of RISK_SUBREDDITS) {
    if (config.names.some((name) => subredditSet.has(normalize(name)))) {
      flags.add(config.flag);
    }
  }

  if (flags.size > 0) {
    notes.push("Risk flagging is heuristic and should be reviewed before activation.");
  }

  return {
    flags: Array.from(flags),
    notes
  };
}

function detectDemographicFromAudienceKeyword(audienceKeyword: string): string | null {
  const lower = audienceKeyword.toLowerCase();
  if (lower.includes("gen z") || lower.includes("genz") || lower.includes("gen-z") || lower.includes("zoomer")) {
    return "gen-z";
  }
  if (lower.includes("gen x") || lower.includes("genx") || lower.includes("gen-x")) {
    return "gen-x";
  }
  if (lower.includes("millennial")) {
    return "millennial";
  }
  if (lower.includes("boomer")) {
    return "boomer";
  }
  if (lower.includes("parent") || lower.includes(" mum") || lower.includes(" dad") || lower.includes("mother") || lower.includes("father")) {
    return "parent";
  }
  if (lower.includes("student") || lower.includes("university") || lower.includes(" uni ") || lower.includes("graduate")) {
    return "student";
  }
  if (lower.includes("teen")) {
    return "teen";
  }
  return null;
}

function detectAudienceAlignment(input: {
  audienceKeyword: string;
  playgroundId: string;
}): { type: "core" | "adjacent" | "unknown"; note: string } {
  const taxonomyItem = PLAYGROUND_TAXONOMY.find((item) => item.id === input.playgroundId);
  if (!taxonomyItem) {
    return { type: "unknown", note: "" };
  }
  const detectedDemo = detectDemographicFromAudienceKeyword(input.audienceKeyword);
  if (!detectedDemo) {
    return { type: "unknown", note: "" };
  }
  if (taxonomyItem.primaryAudience.includes(detectedDemo)) {
    return { type: "core", note: "" };
  }
  const adjacentNote = taxonomyItem.adjacentAudiences[detectedDemo];
  if (adjacentNote) {
    return { type: "adjacent", note: adjacentNote };
  }
  return { type: "unknown", note: "" };
}

function baseKeywordContext(input: PlaygroundDiscoveryRequest): {
  insightsKeywords: string[];
  brandObjectiveKeywords: string[];
  keywordSetInPlayPreview: string[];
} {
  const insightsKeywords = dedupe([
    ...(input.insights?.audience?.derived.seedKeywords || []),
    ...(input.insights?.search?.derived.seedKeywords || [])
  ]);
  const brandObjectiveKeywords = dedupe([
    ...(input.brief.brand ? tokenize(input.brief.brand) : []),
    ...(input.brief.objective ? tokenize(input.brief.objective) : []),
    ...tokenize(input.brief.audienceKeyword)
  ]);
  const keywordSetInPlayPreview = dedupe([
    ...((input.brief.boostKeywords || []).slice(0, 6)),
    ...((input.insights?.search?.queriesLatestMonth.byTrend.fastRising || [])
      .slice(0, 4)
      .map((row) => row.query)),
    ...((input.insights?.audience?.topAffinities || [])
      .slice(0, 2)
      .map((row) => row.item)),
    ...brandObjectiveKeywords
  ], 20);

  return {
    insightsKeywords,
    brandObjectiveKeywords,
    keywordSetInPlayPreview
  };
}

function computeFitScore(input: {
  taxonomySeedKeywords: string[];
  keywordSetInPlay: string[];
  insightsKeywords: string[];
  brandObjectiveKeywords: string[];
  hasInsights: boolean;
}): number {
  const taxonomyOverlap = overlapScore(input.taxonomySeedKeywords, input.keywordSetInPlay);
  const insightsOverlap = overlapScore(input.taxonomySeedKeywords, input.insightsKeywords);
  const brandObjectiveMatch = overlapScore(input.taxonomySeedKeywords, input.brandObjectiveKeywords);
  const overlapSignals = [taxonomyOverlap, insightsOverlap, brandObjectiveMatch].filter((score) => score > 0).length;

  const calibrateSparseOverlap = (rawScore: number, signalCount: number): number => {
    if (rawScore <= 0) {
      return 0;
    }

    // Keep relative ordering from weighted overlap, but scale sparse matches so
    // one meaningful keyword hit is not interpreted as near-zero confidence.
    const scaled = rawScore * 1.85 + 8;
    const sparseBonus = signalCount === 1 ? 6 : signalCount === 2 ? 3 : 0;
    return clamp(Math.round(scaled + sparseBonus), 0, 100);
  };

  if (input.hasInsights) {
    const raw = taxonomyOverlap * 0.45 + insightsOverlap * 0.35 + brandObjectiveMatch * 0.2;
    return calibrateSparseOverlap(raw, overlapSignals);
  }

  const raw = taxonomyOverlap * 0.8 + brandObjectiveMatch * 0.2;
  const basicSignals = [taxonomyOverlap, brandObjectiveMatch].filter((score) => score > 0).length;
  return calibrateSparseOverlap(raw, basicSignals);
}

async function evaluateCandidateSignals(input: {
  candidate: PlaygroundCandidate;
  request: PlaygroundDiscoveryRequest;
}): Promise<{
  candidate: PlaygroundCandidate;
  providerStatus: {
    keywordsUsed: string[];
    googleTrends: {
      status: "OK" | "FAILED" | "SKIPPED";
      ms: number;
      items: number;
      message?: string;
    };
    reddit: {
      status: "OK" | "FAILED" | "SKIPPED";
      ms: number;
      items: number;
      message?: string;
    };
  };
  warnings: string[];
}> {
  const warnings: string[] = [];
  const queryTerms = selectCandidateQueryTerms(input.candidate);

  const startedGoogle = Date.now();
  const signalsResult = await generateSignals({
    keywords: queryTerms,
    audience: input.request.brief.audienceKeyword,
    from: input.request.brief.from,
    to: input.request.brief.to,
    maxKeywords: 2,
    includeGoogleTrends: true,
    includeReddit: true,
    includeWikimedia: false
  });
  const googleMs = Date.now() - startedGoogle;
  const google = signalsResult.signals.googleTrends;
  const reddit = signalsResult.signals.reddit;

  warnings.push(...signalsResult.signals.warnings);

  const risingQueries = (google?.topRelatedQueries || []).filter((item) => item.type === "rising");
  const risingTopics = (google?.topRelatedTopics || []).filter((item) => item.type === "rising");
  const risingIntensity = average(risingQueries.map((item) => normalizeTrendValue(item.value)));
  const demandScore = clamp(
    Math.round(
      clamp(risingQueries.length * 7 + risingTopics.length * 5, 0, 55) +
        Math.round(risingIntensity * 0.35) +
        (risingQueries.length > 0 && risingTopics.length > 0
          ? 10
          : risingQueries.length > 0 || risingTopics.length > 0
            ? 6
            : 0)
    ),
    0,
    100
  );

  const redditPosts = reddit?.topPosts || [];
  const redditCommentsAvg = average(redditPosts.map((post) => safeNumber(post.comments)));
  const redditScoreAvg = average(redditPosts.map((post) => safeNumber(post.score)));
  const conversationScore = clamp(
    Math.round(
      clamp((reddit?.topPosts.length || 0) * 5, 0, 30) +
        clamp((reddit?.subredditCandidates.length || 0) * 8, 0, 24) +
        clamp((reddit?.commonThemes.length || 0) * 4, 0, 20) +
        clamp(Math.round(Math.log10(redditCommentsAvg + 1) * 12), 0, 16) +
        clamp(Math.round(Math.log10(redditScoreAvg + 1) * 7), 0, 10)
    ),
    0,
    100
  );

  const evidencePointers: string[] = [];
  (google?.topRelatedQueries || [])
    .slice(0, 3)
    .forEach((_item, index) => evidencePointers.push(`signals.googleTrends.topRelatedQueries[${index}]`));
  (reddit?.commonThemes || [])
    .slice(0, 2)
    .forEach((_item, index) => evidencePointers.push(`signals.reddit.commonThemes[${index}]`));
  (reddit?.topPosts || [])
    .slice(0, 2)
    .forEach((_item, index) => evidencePointers.push(`signals.reddit.topPosts[${index}]`));

  if (input.request.insights?.audience?.topAffinities?.length) {
    evidencePointers.push("insights.audience.topAffinities[0]");
  }
  if (input.request.insights?.search?.queriesLatestMonth.byTrend.fastRising.length) {
    evidencePointers.push("insights.search.queriesLatestMonth.byTrend.fastRising[0]");
  }

  const risk = detectRiskFlags({
    keywords: [...queryTerms, ...(reddit?.commonThemes || [])],
    subredditNames: (reddit?.subredditCandidates || []).map((item) => item.name),
    redditTitles: (reddit?.topPosts || []).map((item) => item.title)
  });

  const enrichedCandidate: PlaygroundCandidate = PlaygroundCandidateSchema.parse({
    ...input.candidate,
    demandScore,
    conversationScore,
    categoryBaseline: buildCategoryBaseline({
      candidate: input.candidate,
      from: input.request.brief.from,
      to: input.request.brief.to,
      demandScore,
      conversationScore
    }),
    evidenceQa: buildEvidenceQa({
      candidate: input.candidate,
      google,
      reddit,
      evidencePointers,
      generatedAt: signalsResult.signals.meta.generatedAt
    }),
    whyNow: buildWhyNow({ demandScore, conversationScore }),
    communities: {
      subreddits: (reddit?.subredditCandidates || []).map((item) => item.name).slice(0, 3)
    },
    riskFlags: risk.flags,
    evidencePointers: dedupe([...input.candidate.evidencePointers, ...evidencePointers], 12),
    notes: dedupe([...input.candidate.notes, ...risk.notes], 6)
  });

  return {
    candidate: enrichedCandidate,
    providerStatus: {
      keywordsUsed: queryTerms,
      googleTrends: {
        status: google ? "OK" : "FAILED",
        ms: googleMs,
        items: (google?.topRelatedQueries.length || 0) + (google?.topRelatedTopics.length || 0),
        message: signalsResult.providers.googleTrends.message
      },
      reddit: {
        status: reddit ? "OK" : "FAILED",
        ms: signalsResult.providers.reddit.ms,
        items: (reddit?.topPosts.length || 0) + (reddit?.commonThemes.length || 0),
        message: signalsResult.providers.reddit.message
      }
    },
    warnings
  };
}

export async function discoverPlaygrounds(
  input: PlaygroundDiscoveryRequest
): Promise<{
  candidates: PlaygroundCandidate[];
  meta: {
    version: "v2";
    keywordSetInPlayPreview: string[];
    providerStatus: Record<string, unknown>;
    queryStrategy: Record<string, unknown>;
    queriesUsed: string[];
    warnings: string[];
  };
}> {
  const maxCandidates = clamp(input.options?.maxCandidates || 6, 3, 8);
  const hasInsights = Boolean(input.insights?.audience || input.insights?.search);
  const includePerplexity = input.options?.includePerplexity !== false;
  const brandSignalResult = input.brief.brand
    ? await generateBrandSignals({
        version: "v2",
        brief: {
          brand: input.brief.brand,
          objective: input.brief.objective,
          audienceKeyword: input.brief.audienceKeyword,
          from: input.brief.from,
          to: input.brief.to,
          boostKeywords: input.brief.boostKeywords,
          exclusions: input.brief.exclusions
        },
        options: {
          includePerplexity,
          refresh: Boolean(input.options?.refresh)
        }
      })
    : null;

  const brandAdjacencyKeywords = brandSignalResult?.brandSignals.brandAdjacencyKeywords || [];
  const brandSubreddits = brandSignalResult?.brandSignals.brandSubreddits || [];
  const context = baseKeywordContext({
    ...input,
    brief: {
      ...input.brief,
      boostKeywords: dedupe([...(input.brief.boostKeywords || []), ...brandAdjacencyKeywords.slice(0, 6)], 12)
    }
  });

  const baseCandidates = PLAYGROUND_TAXONOMY.map((item) => {
    const candidateKeywords = buildKeywordSet({
      userBoostKeywords: dedupe([...(input.brief.boostKeywords || []), ...brandAdjacencyKeywords.slice(0, 6)], 12),
      audienceKeyword: input.brief.audienceKeyword,
      brand: input.brief.brand,
      objective: input.brief.objective,
      exclusions: input.brief.exclusions || [],
      insights: input.insights,
      playgroundSeedKeywords: item.seedKeywords
    });

    const fitScore = computeFitScore({
      taxonomySeedKeywords: item.seedKeywords,
      keywordSetInPlay: context.keywordSetInPlayPreview,
      insightsKeywords: context.insightsKeywords,
      brandObjectiveKeywords: context.brandObjectiveKeywords,
      hasInsights
    });

    return PlaygroundCandidateSchema.parse({
      id: item.id,
      name: item.name,
      definition: item.description,
      whyNow: "Initial deterministic fit based on brief and available insights.",
      fitScore,
      demandScore: 0,
      conversationScore: 0,
      riskFlags: detectRiskFlags({
        keywords: [...candidateKeywords.core, ...brandAdjacencyKeywords.slice(0, 8)],
        subredditNames: brandSubreddits,
        redditTitles: []
      }).flags,
      evidencePointers: dedupe(
        [
          ...(brandSignalResult?.brandSignals.evidencePointers || []).slice(0, 4),
          ...(hasInsights ? ["insights.audience.topAffinities[0]", "insights.search.queriesLatestMonth.byTrend.fastRising[0]"] : [])
        ],
        12
      ),
      keywords: candidateKeywords,
      communities: { subreddits: brandSubreddits.slice(0, 3) },
      recommendedCategories: item.categories,
      audienceAlignment: detectAudienceAlignment({
        audienceKeyword: input.brief.audienceKeyword,
        playgroundId: item.id
      }),
      notes: brandSignalResult?.meta.skipped ? [] : ["Brand discourse incorporated into playground fit."]
    });
  }).sort((a, b) => {
    const aEffective = a.audienceAlignment?.type === "adjacent" ? Math.max(0, a.fitScore - 12) : a.fitScore;
    const bEffective = b.audienceAlignment?.type === "adjacent" ? Math.max(0, b.fitScore - 12) : b.fitScore;
    if (bEffective !== aEffective) {
      return bEffective - aEffective;
    }
    return a.name.localeCompare(b.name);
  });

  const initialSelection = baseCandidates.slice(0, maxCandidates);
  const warnings: string[] = [];
  const providerStatus: Record<string, unknown> = {};
  let scoredCandidates = initialSelection;
  warnings.push(...(brandSignalResult?.meta.warnings || []));

  if (!input.options?.skipDiscoverySignals) {
    const evaluations = await Promise.all(
      initialSelection.map((candidate) =>
        evaluateCandidateSignals({
          candidate,
          request: input
        })
      )
    );

    scoredCandidates = evaluations.map((item) => item.candidate).sort((a, b) => {
      // Adjacent picks are demoted by a virtual -12 penalty so core-aligned
      // candidates always surface above them unless the adjacent pick is
      // clearly dominant (>12 pts ahead).
      const aEffective = a.audienceAlignment?.type === "adjacent" ? Math.max(0, a.fitScore - 12) : a.fitScore;
      const bEffective = b.audienceAlignment?.type === "adjacent" ? Math.max(0, b.fitScore - 12) : b.fitScore;
      if (bEffective !== aEffective) {
        return bEffective - aEffective;
      }
      if (b.demandScore !== a.demandScore) {
        return b.demandScore - a.demandScore;
      }
      return b.conversationScore - a.conversationScore;
    });

    for (const evaluation of evaluations) {
      warnings.push(...evaluation.warnings);
      providerStatus[evaluation.candidate.id] = evaluation.providerStatus;
    }
  } else {
    for (const candidate of scoredCandidates) {
      providerStatus[candidate.id] = {
        googleTrends: { status: "SKIPPED", ms: 0, items: 0 },
        reddit: { status: "SKIPPED", ms: 0, items: 0 }
      };
    }
  }

  const strongCandidates = scoredCandidates.filter((candidate) => candidate.fitScore >= 30);
  const minimumCandidates = Math.min(5, maxCandidates);
  const dynamicCount = clamp(strongCandidates.length, minimumCandidates, maxCandidates);
  const candidates = scoredCandidates.slice(0, dynamicCount);

  if (strongCandidates.length < minimumCandidates) {
    warnings.push("Low-confidence playground suggestions (limited overlap signals).");
  }

  return {
    candidates,
    meta: {
      version: "v2",
      keywordSetInPlayPreview: context.keywordSetInPlayPreview,
      providerStatus,
      queryStrategy: {
        keywordSet: {
          preview: context.keywordSetInPlayPreview
        },
        phaseA: {
          executed: Boolean(input.brief.brand),
          redditQueries: brandSignalResult?.meta.queryStrategy.phaseA.redditQueries || [],
          redditQueryCap: 3,
          redditPostCap: 15,
          perplexityAttempted:
            Boolean(input.brief.brand) &&
            includePerplexity &&
            Boolean(process.env.PERPLEXITY_API_KEY)
        },
        phaseB: {
          discoverySignalsEnabled: !input.options?.skipDiscoverySignals,
          trendsTermsPerCandidateCap: 2,
          redditTermsPerCandidateCap: 2,
          candidateCount: candidates.length
        }
      },
      queriesUsed: brandSignalResult?.meta.queriesUsed || [],
      warnings: dedupe(warnings, 12)
    }
  };
}

function mergeChosenKeywords(input: {
  base: { core: string[]; expansion: string[]; negative: string[] };
  edits?: { core?: string[]; expansion?: string[]; negative?: string[] };
}): { core: string[]; expansion: string[]; negative: string[]; inPlay: string[] } {
  const core = dedupe(input.edits?.core?.length ? input.edits.core : input.base.core, 12);
  const expansion = dedupe(
    input.edits?.expansion?.length ? input.edits.expansion : input.base.expansion,
    18
  );
  const negative = dedupe(
    input.edits?.negative?.length ? input.edits.negative : input.base.negative,
    10
  );

  return {
    core,
    expansion,
    negative,
    inPlay: dedupe([...core, ...expansion], 30)
  };
}

function chooseCategories(input: {
  userCategories?: Array<"sports" | "film" | "holidays" | "events">;
  recommended: Array<"sports" | "film" | "holidays" | "events">;
}): { categories: string[]; warning?: string } {
  const userCategories = input.userCategories || [];
  let categories: string[];
  let warning: string | undefined;

  if (userCategories.length === 0) {
    categories = [...input.recommended];
  } else {
    const intersection = userCategories.filter((value) => input.recommended.includes(value));
    if (intersection.length > 0) {
      categories = intersection;
    } else {
      categories = [...userCategories];
      warning = `Playground suggests ${input.recommended.join(", ")}, but you selected ${userCategories.join(", ")}; using your selection.`;
    }
  }

  // Always include holidays — awareness days and bank holidays are free,
  // need no API key, and provide essential cultural context for every brief.
  if (!categories.includes("holidays")) {
    categories.push("holidays");
  }
  // Always include sports — F1 is free (no API key), and football keys are usually present.
  if (!categories.includes("sports")) {
    categories.push("sports");
  }

  return { categories, warning };
}

function buildMomentCorpus(moment: { title: string; subcategory?: string; tags: string[] }): string {
  return normalize([moment.title, moment.subcategory || "", ...moment.tags].join(" "));
}

function labelMatchesCorpus(label: string, corpus: string): boolean {
  const value = normalize(label);
  if (!value) {
    return false;
  }

  // Exact substring match (fast path)
  if (corpus.includes(value)) {
    return true;
  }

  // Token-based match: all label tokens must appear in corpus
  const labelTokens = tokenize(value);
  if (labelTokens.length === 0) {
    return false;
  }
  const corpusTokens = new Set(tokenize(corpus));
  return labelTokens.every((token) => corpusTokens.has(token));
}

function deriveWikiCandidatesFromMoments(moments: Array<{ title: string }>): string[] {
  return dedupe(moments.map((moment) => moment.title), 5);
}

export function collectPointerUniverse(planData: PlanData): {
  all: Set<string>;
  byMoment: Map<string, Set<string>>;
  wikiMatchedMomentIds: string[];
} {
  const all = new Set<string>();
  const byMoment = new Map<string, Set<string>>();
  const wikiMatchedMomentIds: string[] = [];

  (planData.insights?.audience?.topAffinities || []).forEach((_item, index) =>
    all.add(`insights.audience.topAffinities[${index}]`)
  );
  (planData.insights?.search?.queriesLatestMonth.byTrend.fastRising || []).forEach((_item, index) =>
    all.add(`insights.search.queriesLatestMonth.byTrend.fastRising[${index}]`)
  );
  (planData.signals.googleTrends?.topRelatedQueries || []).forEach((_item, index) =>
    all.add(`signals.googleTrends.topRelatedQueries[${index}]`)
  );
  (planData.signals.googleTrends?.topRelatedTopics || []).forEach((_item, index) =>
    all.add(`signals.googleTrends.topRelatedTopics[${index}]`)
  );
  (planData.signals.reddit?.commonThemes || []).forEach((_item, index) =>
    all.add(`signals.reddit.commonThemes[${index}]`)
  );
  (planData.signals.reddit?.topPosts || []).forEach((_item, index) =>
    all.add(`signals.reddit.topPosts[${index}]`)
  );
  (planData.signals.wikimedia?.entities || []).forEach((_item, index) =>
    all.add(`signals.wikimedia.entities[${index}]`)
  );

  for (const moment of planData.moments) {
    const pointers = new Set<string>(moment.evidencePointers || []);
    byMoment.set(moment.id, pointers);
    pointers.forEach((pointer) => all.add(pointer));
    if ((moment.signalMatch?.matched.wiki.length || 0) > 0) {
      wikiMatchedMomentIds.push(moment.id);
    }
  }

  return { all, byMoment, wikiMatchedMomentIds };
}

export async function buildPlanData(
  input: PlanDataRequest
): Promise<PlanData> {
  const taxonomyItem = PLAYGROUND_TAXONOMY.find((item) => item.id === input.chosenPlayground.playgroundId);
  if (!taxonomyItem) {
    throw new Error(`Unknown playground id: ${input.chosenPlayground.playgroundId}`);
  }

  const brandSignalResult = input.brief.brand
    ? await generateBrandSignals({
        version: "v2",
        brief: {
          brand: input.brief.brand,
          objective: input.brief.objective,
          audienceKeyword: input.brief.audienceKeyword,
          from: input.brief.from,
          to: input.brief.to,
          boostKeywords: input.brief.boostKeywords,
          exclusions: input.brief.exclusions
        },
        options: {
          includePerplexity: false,
          refresh: Boolean(input.options?.refresh)
        }
      })
    : null;

  const brandAdjacencyKeywords = brandSignalResult?.brandSignals.brandAdjacencyKeywords || [];

  const baseKeywords = buildKeywordSet({
    userBoostKeywords: dedupe([...(input.brief.boostKeywords || []), ...brandAdjacencyKeywords.slice(0, 6)], 12),
    audienceKeyword: input.brief.audienceKeyword,
    brand: input.brief.brand,
    objective: input.brief.objective,
    exclusions: input.brief.exclusions || [],
    insights: input.insights,
    playgroundSeedKeywords: taxonomyItem.seedKeywords
  });
  const mergedKeywords = mergeChosenKeywords({
    base: baseKeywords,
    edits: input.chosenPlayground.userEditedKeywords
  });
  const categorySelection = chooseCategories({
    userCategories: input.brief.categories,
    recommended: taxonomyItem.categories
  });
  const coverageNotes: string[] = [];
  if (categorySelection.warning) {
    coverageNotes.push(categorySelection.warning);
  }

  const momentsResultRaw = await collectMoments({
    from: input.brief.from,
    to: input.brief.to,
    categories: categorySelection.categories,
    keywords: mergedKeywords.inPlay,
    audience: input.brief.audienceKeyword,
    brandConstraints: input.brief.objective,
    forceRefresh: Boolean(input.options?.refresh)
  });

  // Filter out moments matching negative keywords
  const negativeTokens = new Set(mergedKeywords.negative.flatMap((kw) => tokenize(kw)));
  const momentsResult = negativeTokens.size > 0
    ? {
        ...momentsResultRaw,
        moments: momentsResultRaw.moments.filter((moment) => {
          const corpus = buildMomentCorpus(moment);
          const corpusTokens = new Set(tokenize(corpus));
          return !Array.from(negativeTokens).some((neg) => corpusTokens.has(neg));
        })
      }
    : momentsResultRaw;

  if (negativeTokens.size > 0 && momentsResult.moments.length < momentsResultRaw.moments.length) {
    const filtered = momentsResultRaw.moments.length - momentsResult.moments.length;
    coverageNotes.push(`${filtered} moment(s) removed by negative keyword filter.`);
  }

  const signalTerms = dedupe(
    [...mergedKeywords.core.slice(0, 8), ...mergedKeywords.expansion.slice(0, 4)],
    12
  );

  const fullSignals = await generateSignals({
    keywords: signalTerms,
    audience: input.brief.audienceKeyword,
    from: input.brief.from,
    to: input.brief.to,
    maxKeywords: 12,
    includeGoogleTrends: true,
    includeReddit: true,
    includeWikimedia: false
  });

  const wikiStart = Date.now();
  const wikiCandidates = deriveWikiCandidatesFromMoments(
    momentsResult.moments.slice(0, 10).map((moment) => ({ title: moment.title }))
  );
  const wikiResult = await collectWikimediaSignals({
    keywords: wikiCandidates,
    audience: input.brief.audienceKeyword,
    from: input.brief.from,
    to: input.brief.to,
    momentTitles: momentsResult.moments.slice(0, 10).map((moment) => moment.title)
  });
  const wikiMs = Date.now() - wikiStart;

  const signals = {
    ...fullSignals.signals,
    wikimedia: wikiResult.data || {
      entities: [],
      sources: [{ name: "Wikimedia Pageviews", url: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews" }]
    },
    warnings: dedupe([...fullSignals.signals.warnings, ...wikiResult.warnings], 20),
    meta: {
      ...fullSignals.signals.meta,
      providers: {
        ...fullSignals.signals.meta.providers,
        wikimedia: {
          status: wikiResult.data ? "OK" : "FAILED",
          ms: wikiMs,
          cache: "n/a",
          items: wikiResult.data?.entities.length || 0,
          message: wikiResult.warnings[0]
        }
      }
    }
  };

  const trendsLabels = dedupe([
    ...(signals.googleTrends?.topRelatedQueries || []).map((item) => item.query),
    ...(signals.googleTrends?.topRelatedTopics || []).map((item) => item.topic)
  ], 30);
  const redditThemes = dedupe([...(signals.reddit?.commonThemes || [])], 20);
  const redditPosts = signals.reddit?.topPosts || [];
  const wikiEntities = signals.wikimedia?.entities || [];

  const moments = momentsResult.moments.map((moment) => {
    const corpus = buildMomentCorpus(moment);
    const matchedTrends: Array<{ label: string; pointer: string }> = [];
    const matchedReddit: Array<{ label: string; pointer: string; url?: string }> = [];
    const matchedWiki: Array<{ entity: string; pointer: string }> = [];
    const matchedKeywords = new Set<string>();

    trendsLabels.forEach((label, index) => {
      if (labelMatchesCorpus(label, corpus)) {
        matchedTrends.push({
          label,
          pointer: `signals.googleTrends.topRelatedQueries[${index}]`
        });
        matchedKeywords.add(label);
      }
    });

    redditThemes.forEach((label, index) => {
      if (labelMatchesCorpus(label, corpus)) {
        matchedReddit.push({
          label,
          pointer: `signals.reddit.commonThemes[${index}]`
        });
        matchedKeywords.add(label);
      }
    });

    redditPosts.forEach((post, index) => {
      if (labelMatchesCorpus(post.title, corpus)) {
        matchedReddit.push({
          label: post.title,
          pointer: `signals.reddit.topPosts[${index}]`,
          url: post.url
        });
        matchedKeywords.add(post.title);
      }
    });

    wikiEntities.forEach((entity, index) => {
      if (labelMatchesCorpus(entity.title, corpus)) {
        matchedWiki.push({
          entity: entity.title,
          pointer: `signals.wikimedia.entities[${index}]`
        });
        matchedKeywords.add(entity.title);
      }
    });

    const trendsBoost = clamp(matchedTrends.length > 0 ? 4 + (matchedTrends.length - 1) * 2 : 0, 0, 8);
    const redditBoost = clamp(matchedReddit.length > 0 ? 3 + (matchedReddit.length - 1) * 2 : 0, 0, 6);
    const wikiBoost = clamp(matchedWiki.length > 0 ? 5 + (matchedWiki.length - 1) * 3 : 0, 0, 10);
    const totalBoost = clamp(trendsBoost + redditBoost + wikiBoost, 0, 20);
    const evidencePointers = dedupe([
      ...matchedTrends.map((item) => item.pointer),
      ...matchedReddit.map((item) => item.pointer),
      ...matchedWiki.map((item) => item.pointer)
    ], 20);

    return {
      ...moment,
      baseScore: moment.score,
      finalScore: moment.score + totalBoost,
      signalBoost: {
        trends: trendsBoost,
        reddit: redditBoost,
        wiki: wikiBoost,
        total: totalBoost
      },
      evidencePointers,
      signalMatch: {
        momentId: moment.id,
        matched: {
          trends: matchedTrends,
          reddit: matchedReddit,
          wiki: matchedWiki
        },
        signalBoost: {
          trends: trendsBoost,
          reddit: redditBoost,
          wiki: wikiBoost,
          total: totalBoost
        },
        evidencePointers,
        debug: {
          matchedKeywords: Array.from(matchedKeywords).slice(0, 20)
        }
      }
    };
  }).sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
  });

  const wikiMatchesCount = moments.filter((moment) => (moment.signalMatch?.matched.wiki.length || 0) > 0).length;
  if (wikiResult.data && wikiMatchesCount === 0) {
    coverageNotes.push("Wikimedia returned entities, but no direct moment-title matches were found.");
  }

  const planData = PlanDataSchema.parse({
    playground: {
      candidate: {
        id: taxonomyItem.id,
        name: taxonomyItem.name,
        definition: taxonomyItem.description,
        whyNow: "Chosen playground for current planning window.",
        fitScore: 70,
        demandScore: scoreDemand({
          id: taxonomyItem.id,
          name: taxonomyItem.name,
          definition: taxonomyItem.description,
          whyNow: "",
          fitScore: 70,
          demandScore: 0,
          conversationScore: 0,
          riskFlags: [],
          evidencePointers: [],
          keywords: mergedKeywords,
          communities: { subreddits: (signals.reddit?.subredditCandidates || []).map((item) => item.name).slice(0, 3) },
          recommendedCategories: taxonomyItem.categories,
          notes: []
        }),
        conversationScore: scoreConversation({
          id: taxonomyItem.id,
          name: taxonomyItem.name,
          definition: taxonomyItem.description,
          whyNow: "",
          fitScore: 70,
          demandScore: 0,
          conversationScore: 0,
          riskFlags: [],
          evidencePointers: [],
          keywords: mergedKeywords,
          communities: { subreddits: (signals.reddit?.subredditCandidates || []).map((item) => item.name).slice(0, 3) },
          recommendedCategories: taxonomyItem.categories,
          notes: []
        }),
        riskFlags: [],
        evidencePointers: dedupe(
          [
            ...(brandSignalResult?.brandSignals.evidencePointers || []).slice(0, 3),
            ...(signals.googleTrends?.topRelatedQueries || []).slice(0, 2).map((_item, index) => `signals.googleTrends.topRelatedQueries[${index}]`)
          ],
          10
        ),
        keywords: {
          core: mergedKeywords.core,
          expansion: mergedKeywords.expansion,
          negative: mergedKeywords.negative
        },
        communities: {
          subreddits: (signals.reddit?.subredditCandidates || []).map((item) => item.name).slice(0, 3)
        },
        recommendedCategories: taxonomyItem.categories,
        notes: []
      },
      userEditedKeywords: input.chosenPlayground.userEditedKeywords
    },
    moments,
    signals,
    insights: input.insights,
    meta: {
      keywordSetInPlay: mergedKeywords.inPlay,
      providerStatus: {
        ...fullSignals.providers,
        wikimediaValidation: {
          status: wikiResult.data ? "OK" : "FAILED",
          ms: wikiMs,
          items: wikiResult.data?.entities.length || 0
        }
      },
      wikiMatchesCount,
      coverageNotes: dedupe([
        ...coverageNotes,
        ...momentsResult.meta.warnings.slice(0, 4)
      ], 12),
      warnings: dedupe([
        ...momentsResult.meta.warnings,
        ...signals.warnings,
        ...(brandSignalResult?.meta.warnings || [])
      ], 30),
      queryStrategy: {
        phaseA: {
          executed: Boolean(input.brief.brand),
          redditQueries: brandSignalResult?.meta.queryStrategy.phaseA.redditQueries || [],
          redditQueryCap: 3,
          redditPostCap: 15
        },
        phaseC: {
          signalTerms: signalTerms,
          signalTermCap: 12,
          wikiEntityCap: 5,
          wikiEntitiesQueried: wikiCandidates
        }
      },
      insightsSummary: {
        audienceAffinities: input.insights?.audience?.topAffinities.length || 0,
        searchFastRising: input.insights?.search?.queriesLatestMonth.byTrend.fastRising.length || 0
      },
      signalsSummary: {
        trendsQueries: signals.googleTrends?.topRelatedQueries.length || 0,
        redditPosts: signals.reddit?.topPosts.length || 0,
        wikiEntities: signals.wikimedia?.entities.length || 0
      },
      version: "v2"
    }
  });

  return planData;
}

export async function discoverPlaygroundsCached(
  input: PlaygroundDiscoveryRequest,
  forceRefresh = false
): Promise<Awaited<ReturnType<typeof discoverPlaygrounds>>> {
  const { payload } = await withConnectorCache({
    connector: "playground-discovery-v2",
    params: {
      brief: input.brief,
      insights: input.insights
        ? {
            audienceKeywords: input.insights.audience?.derived.seedKeywords || [],
            searchKeywords: input.insights.search?.derived.seedKeywords || []
          }
        : null,
      options: input.options || {}
    },
    keyPresent: true,
    forceRefresh,
    fetcher: async () => discoverPlaygrounds(input)
  });

  return payload;
}

export async function buildPlanDataCached(
  input: PlanDataRequest,
  forceRefresh = false
): Promise<PlanData> {
  const { payload } = await withConnectorCache({
    connector: "plan-data-v2",
    params: {
      brief: input.brief,
      chosenPlayground: input.chosenPlayground,
      insights: input.insights
        ? {
            audienceKeywords: input.insights.audience?.derived.seedKeywords || [],
            searchKeywords: input.insights.search?.derived.seedKeywords || []
          }
        : null,
      options: input.options || {}
    },
    keyPresent: true,
    forceRefresh,
    fetcher: async () => buildPlanData(input)
  });

  return payload;
}
