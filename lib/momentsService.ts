import { ALL_CATEGORIES, MAX_DATE_RANGE_DAYS } from "@/lib/config";
import { dedupeMoments } from "@/lib/dedupe";
import { FetchError } from "@/lib/fetchWithRetry";
import { applyScores } from "@/lib/scoring";
import { rerankMomentsWithLlm } from "@/lib/relevanceRankingService";
import { collectFootballFixtures } from "@/lib/connectors/footballData";
import { collectGovUkBankHolidays } from "@/lib/connectors/govUkHolidays";
import { collectRapidApiFootballFixtures } from "@/lib/connectors/rapidApiFootball";
import { collectTicketmasterEvents } from "@/lib/connectors/ticketmaster";
import { collectTmdbFilms } from "@/lib/connectors/tmdb";
import { collectTmdbTvShows } from "@/lib/connectors/tmdbTv";
import { collectAwarenessDays } from "@/lib/connectors/awarenessDays";
import { collectOpenF1Sessions } from "@/lib/connectors/openF1";
import { collectRawgGames } from "@/lib/connectors/rawgGames";
import type { ConnectorResult } from "@/lib/connectors/types";
import { MomentSchema, ScoredMomentSchema, type ScoredMoment } from "@/lib/schemas/moment";

export type SkippedConnector = {
  name: string;
  reason: string;
};

export type MomentsMeta = {
  enabledConnectors: string[];
  skippedConnectors: SkippedConnector[];
  cache: {
    hits: string[];
    misses: string[];
  };
  warnings: string[];
};

export type CollectMomentsInput = {
  from: string;
  to: string;
  categories: string[];
  keywords: string[];
  audience?: string;
  brandConstraints?: string;
  city?: string;
  forceRefresh?: boolean;
};

export type CollectMomentsOutput = {
  moments: ScoredMoment[];
  meta: MomentsMeta;
};

function dayRange(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime();
  const b = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function normalizeCategories(categories: string[]): string[] {
  if (categories.length === 0) {
    return [...ALL_CATEGORIES];
  }
  const allowed = new Set(ALL_CATEGORIES);
  return categories.filter((category) => allowed.has(category as (typeof ALL_CATEGORIES)[number]));
}

async function runConnectorSafe(
  run: () => Promise<ConnectorResult>,
  name: string
): Promise<{ result?: ConnectorResult; warning?: string }> {
  try {
    const result = await run();
    return { result };
  } catch (error) {
    if (error instanceof FetchError) {
      return {
        warning: `${name} failed: ${error.message}${error.status ? ` (status ${error.status})` : ""}`
      };
    }
    return {
      warning: `${name} failed with an unexpected error.`
    };
  }
}

export async function collectMoments(input: CollectMomentsInput): Promise<CollectMomentsOutput> {
  if (dayRange(input.from, input.to) > MAX_DATE_RANGE_DAYS) {
    throw new Error(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  }

  const categories = normalizeCategories(input.categories);
  const warnings: string[] = [];
  const skippedConnectors: SkippedConnector[] = [];
  const enabledConnectors: string[] = [];
  const hits: string[] = [];
  const misses: string[] = [];

  const tasks: Array<Promise<{ result?: ConnectorResult; warning?: string }>> = [];

  if (categories.includes("holidays")) {
    tasks.push(
      runConnectorSafe(
        () => collectGovUkBankHolidays({ from: input.from, to: input.to, forceRefresh: input.forceRefresh }),
        "gov-uk-holidays"
      )
    );
    tasks.push(
      runConnectorSafe(
        () => collectAwarenessDays({ from: input.from, to: input.to, forceRefresh: input.forceRefresh }),
        "awareness-days"
      )
    );
  }

  if (categories.includes("film")) {
    if (!process.env.TMDB_API_KEY) {
      skippedConnectors.push({
        name: "tmdb-films",
        reason: "TMDB_API_KEY missing"
      });
    } else {
      tasks.push(
        runConnectorSafe(
          () =>
            collectTmdbFilms(
              { from: input.from, to: input.to, forceRefresh: input.forceRefresh },
              process.env.TMDB_API_KEY as string
            ),
          "tmdb-films"
        )
      );
      tasks.push(
        runConnectorSafe(
          () =>
            collectTmdbTvShows(
              { from: input.from, to: input.to, forceRefresh: input.forceRefresh },
              process.env.TMDB_API_KEY as string
            ),
          "tmdb-tv"
        )
      );
    }
  }

  if (categories.includes("sports")) {
    if (process.env.FOOTBALL_DATA_API_KEY) {
      tasks.push(
        runConnectorSafe(
          () =>
            collectFootballFixtures(
              { from: input.from, to: input.to, forceRefresh: input.forceRefresh },
              process.env.FOOTBALL_DATA_API_KEY as string
            ),
          "football-data"
        )
      );
    } else if (process.env.RAPIDAPI_KEY) {
      tasks.push(
        runConnectorSafe(
          () =>
            collectRapidApiFootballFixtures(
              { from: input.from, to: input.to, forceRefresh: input.forceRefresh },
              process.env.RAPIDAPI_KEY as string
            ),
          "rapidapi-football"
        )
      );
      warnings.push("Using RapidAPI sports fallback because FOOTBALL_DATA_API_KEY is not set.");
    } else {
      skippedConnectors.push({
        name: "sports",
        reason: "FOOTBALL_DATA_API_KEY or RAPIDAPI_KEY missing"
      });
    }

    // OpenF1 — free, no API key required
    tasks.push(
      runConnectorSafe(
        () => collectOpenF1Sessions({ from: input.from, to: input.to, forceRefresh: input.forceRefresh }),
        "openf1-sessions"
      )
    );
  }

  if (categories.includes("events")) {
    if (!process.env.TICKETMASTER_API_KEY) {
      skippedConnectors.push({
        name: "ticketmaster",
        reason: "TICKETMASTER_API_KEY missing"
      });
    } else {
      tasks.push(
        runConnectorSafe(
          () =>
            collectTicketmasterEvents(
              {
                from: input.from,
                to: input.to,
                keywords: input.keywords,
                city: input.city,
                forceRefresh: input.forceRefresh
              },
              process.env.TICKETMASTER_API_KEY as string
            ),
          "ticketmaster"
        )
      );
    }

    // RAWG gaming releases
    if (!process.env.RAWG_API_KEY) {
      skippedConnectors.push({
        name: "rawg-games",
        reason: "RAWG_API_KEY missing"
      });
    } else {
      tasks.push(
        runConnectorSafe(
          () =>
            collectRawgGames(
              { from: input.from, to: input.to, forceRefresh: input.forceRefresh },
              process.env.RAWG_API_KEY as string
            ),
          "rawg-games"
        )
      );
    }
  }

  const settled = await Promise.all(tasks);
  const normalizedMoments = settled
    .flatMap((item) => {
      if (item.warning) {
        warnings.push(item.warning);
      }
      if (!item.result) {
        return [];
      }

      enabledConnectors.push(item.result.name);
      if (item.result.cache === "hit") {
        hits.push(item.result.name);
      } else {
        misses.push(item.result.name);
      }

      warnings.push(...item.result.warnings);
      return item.result.moments;
    })
    .flatMap((rawMoment) => {
      const parsed = MomentSchema.safeParse(rawMoment);
      if (!parsed.success) {
        warnings.push(`Invalid moment skipped: ${parsed.error.issues[0]?.message || "schema mismatch"}`);
        return [];
      }
      return [parsed.data];
    });

  const deduped = dedupeMoments(normalizedMoments);
  let scored = applyScores(deduped, input.keywords).flatMap((moment) => {
    const parsed = ScoredMomentSchema.safeParse(moment);
    if (!parsed.success) {
      warnings.push(`Invalid scored moment skipped: ${parsed.error.issues[0]?.message || "schema mismatch"}`);
      return [];
    }
    return [parsed.data];
  });

  const wantsLlmRelevance =
    input.keywords.length > 0 || Boolean(input.audience?.trim()) || Boolean(input.brandConstraints?.trim());
  if (wantsLlmRelevance && process.env.OPENAI_API_KEY) {
    const reranked = await rerankMomentsWithLlm({
      moments: scored,
      keywords: input.keywords,
      audience: input.audience,
      brandConstraints: input.brandConstraints
    });
    scored = reranked.moments;
    if (reranked.warning) {
      warnings.push(reranked.warning);
    }
  } else if (wantsLlmRelevance && !process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY missing: keyword relevance uses deterministic scoring only.");
  }

  return {
    moments: scored,
    meta: {
      enabledConnectors,
      skippedConnectors,
      cache: { hits, misses },
      warnings
    }
  };
}
