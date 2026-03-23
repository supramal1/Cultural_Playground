import {
  DEFAULT_TIMEZONE,
  RAPIDAPI_FOOTBALL_DEFAULT_HOST,
  RAPIDAPI_LEAGUE_IDS_BY_CODE,
  RAPIDAPI_MAX_REQUESTS_PER_SEARCH,
  REGION,
  V1_SPORTS_COMPETITIONS
} from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

type RapidApiMatchStatus = {
  utcTime?: string;
};

type RapidApiTeam = {
  name?: string;
  longName?: string;
};

type RapidApiMatch = {
  id: number;
  leagueId?: number;
  leagueName?: string;
  time?: string;
  status?: RapidApiMatchStatus;
  home?: RapidApiTeam;
  away?: RapidApiTeam;
  tournamentStage?: string;
};

type RapidApiLeagueBucket = {
  id?: number;
  name?: string;
  matches?: RapidApiMatch[];
};

type RapidApiResponseEnvelope = {
  status?: string;
  message?: string;
  response?: {
    matches?: RapidApiMatch[] | RapidApiLeagueBucket[];
  };
};

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function limitDatesByBudget(dates: string[], budget: number): { dates: string[]; truncated: boolean } {
  const safeBudget = Math.max(1, budget);
  if (dates.length <= safeBudget) {
    return { dates, truncated: false };
  }
  return {
    dates: dates.slice(0, safeBudget),
    truncated: true
  };
}

function parseFallbackDate(timeText?: string): string | null {
  if (!timeText) {
    return null;
  }
  const match = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!match) {
    return null;
  }

  const [, dd, mm, yyyy, hh, min] = match;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isLeagueBucket(value: RapidApiMatch | RapidApiLeagueBucket): value is RapidApiLeagueBucket {
  return Array.isArray((value as RapidApiLeagueBucket).matches);
}

function extractMatches(payload: RapidApiResponseEnvelope): RapidApiMatch[] {
  const candidates = payload.response?.matches;
  if (!Array.isArray(candidates)) {
    return [];
  }

  const flattened: RapidApiMatch[] = [];
  for (const item of candidates) {
    if (isLeagueBucket(item)) {
      const bucketMatches = item.matches || [];
      for (const match of bucketMatches) {
        flattened.push({
          ...match,
          leagueId: match.leagueId ?? item.id,
          leagueName: match.leagueName ?? item.name
        });
      }
      continue;
    }

    flattened.push(item as RapidApiMatch);
  }

  return flattened;
}

function competitionCodeByLeagueId(leagueId?: number): string | undefined {
  if (!leagueId) {
    return undefined;
  }
  const entry = Object.entries(RAPIDAPI_LEAGUE_IDS_BY_CODE).find(([, id]) => id === leagueId);
  return entry?.[0];
}

function competitionNameFromCode(code?: string): string | undefined {
  if (!code) {
    return undefined;
  }
  return V1_SPORTS_COMPETITIONS.find((competition) => competition.code === code)?.name;
}

export async function collectRapidApiFootballFixtures(
  params: ConnectorParams,
  rapidApiKey: string,
  host = process.env.RAPIDAPI_FOOTBALL_HOST || RAPIDAPI_FOOTBALL_DEFAULT_HOST
): Promise<ConnectorResult> {
  const requestBudgetRaw = Number(process.env.RAPIDAPI_MAX_REQUESTS_PER_SEARCH || RAPIDAPI_MAX_REQUESTS_PER_SEARCH);
  const requestBudget = Number.isFinite(requestBudgetRaw) ? Math.max(1, Math.floor(requestBudgetRaw)) : RAPIDAPI_MAX_REQUESTS_PER_SEARCH;

  const { payload, cache } = await withConnectorCache({
    connector: "rapidapi-football-fixtures",
    params: {
      ...params,
      host,
      competitions: RAPIDAPI_LEAGUE_IDS_BY_CODE,
      requestBudget
    },
    keyPresent: Boolean(rapidApiKey),
    forceRefresh: Boolean(params.forceRefresh),
    shouldCache: (candidate) => {
      const warningsText = (candidate.warnings || []).join(" ").toLowerCase();
      const isRateLimited = warningsText.includes("rate limit hit");
      if (isRateLimited && candidate.matches.length === 0) {
        return false;
      }
      return true;
    },
    fetcher: async () => {
      const allDates = enumerateDates(params.from, params.to);
      const limited = limitDatesByBudget(allDates, requestBudget);
      const dates = limited.dates;
      const allMatches: RapidApiMatch[] = [];
      const warnings: string[] = [];
      let callsUsed = 0;

      if (limited.truncated) {
        warnings.push(
          `RapidAPI sports window truncated to ${dates.length} day(s) from range start due request budget.`
        );
      }

      for (const date of dates) {
        try {
          const query = new URLSearchParams({
            date: compactDate(date)
          });

          const response = await fetchWithRetry(
            `https://${host}/football-get-matches-by-date?${query.toString()}`,
            {
              method: "GET",
              headers: {
                "x-rapidapi-key": rapidApiKey,
                "x-rapidapi-host": host
              }
            },
            { timeoutMs: 10_000, retries: 2 }
          );
          callsUsed += 1;

          const json = (await response.json()) as RapidApiResponseEnvelope;
          if (json.status && json.status !== "success") {
            warnings.push(
              `RapidAPI football (${date}) returned status ${json.status}${json.message ? `: ${json.message}` : ""}`
            );
            continue;
          }

          allMatches.push(...extractMatches(json));
        } catch (error) {
          if (error instanceof FetchError && error.status === 429) {
            warnings.push("RapidAPI rate limit hit (429). Returning partial sports results.");
            break;
          }

          if (error instanceof FetchError) {
            warnings.push(
              `RapidAPI football (${date}) request failed${error.status ? `: status ${error.status}` : ""}.`
            );
            continue;
          }

          warnings.push(`RapidAPI football (${date}) request failed unexpectedly.`);
        }
      }

      warnings.push(`RapidAPI sports calls used for this fetch: ${callsUsed}.`);
      return {
        matches: allMatches,
        warnings
      };
    }
  });

  const allowedLeagueIds = new Set(Object.values(RAPIDAPI_LEAGUE_IDS_BY_CODE));
  const moments = payload.matches
    .filter((match) => typeof match.id === "number")
    .filter((match) => (match.leagueId ? allowedLeagueIds.has(match.leagueId) : false))
    .map((match) => {
      const home = match.home?.name || match.home?.longName || "Home";
      const away = match.away?.name || match.away?.longName || "Away";
      const title = `${home} vs ${away}`;
      const subcategory = competitionCodeByLeagueId(match.leagueId);
      const competitionName = match.leagueName || competitionNameFromCode(subcategory);
      const startDateTime =
        match.status?.utcTime ||
        parseFallbackDate(match.time) ||
        `${params.from}T00:00:00.000Z`;

      const tags = [
        subcategory || "",
        competitionName || "",
        home,
        away,
        "rapidapi-football"
      ].filter(Boolean);

      const sourceId = String(match.id);
      return {
        id: buildMomentId({
          sourceName: "rapidapi-football",
          sourceId,
          startDateTime,
          title
        }),
        sourceId,
        title,
        startDateTime,
        timezone: DEFAULT_TIMEZONE,
        region: REGION,
        category: "sports" as const,
        subcategory,
        description:
          `${competitionName || "Football"} fixture sourced from RapidAPI free-api-live-football-data feed.`,
        sourceName: "rapidapi-football",
        sourceUrl: "https://rapidapi.com/Creativesdev/api/free-api-live-football-data",
        confidence: match.status?.utcTime ? ("medium" as const) : ("low" as const),
        tags,
        brandSafetyFlags: []
      };
    });

  return {
    name: "rapidapi-football",
    moments,
    cache,
    warnings: payload.warnings
  };
}
