import { DEFAULT_TIMEZONE, REGION, V1_SPORTS_COMPETITIONS } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://api.football-data.org/v4";

type FootballMatch = {
  id: number;
  utcDate: string;
  competition: {
    name: string;
    code: string;
  };
  homeTeam: {
    name: string;
  };
  awayTeam: {
    name: string;
  };
  venue?: string;
};

type CompetitionMatchesResponse = {
  matches: FootballMatch[];
};

export async function collectFootballFixtures(
  params: ConnectorParams,
  apiKey: string
): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "football-data-fixtures",
    params: {
      ...params,
      competitions: V1_SPORTS_COMPETITIONS.map((c) => c.code)
    },
    keyPresent: Boolean(apiKey),
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const matches: FootballMatch[] = [];

      for (const competition of V1_SPORTS_COMPETITIONS) {
        const query = new URLSearchParams({
          dateFrom: params.from,
          dateTo: params.to
        });

        const response = await fetchWithRetry(
          `${API_ROOT}/competitions/${competition.code}/matches?${query.toString()}`,
          {
            method: "GET",
            headers: {
              "X-Auth-Token": apiKey
            }
          },
          { timeoutMs: 10_000, retries: 2 }
        );

        const json = (await response.json()) as CompetitionMatchesResponse;
        matches.push(...(json.matches || []));
      }

      return matches;
    }
  });

  const moments = payload.map((match) => {
    const sourceId = String(match.id);
    const title = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
    return {
      id: buildMomentId({
        sourceName: "football-data",
        sourceId,
        startDateTime: match.utcDate,
        title
      }),
      sourceId,
      title,
      startDateTime: match.utcDate,
      timezone: DEFAULT_TIMEZONE,
      region: REGION,
      locationName: match.venue,
      category: "sports" as const,
      subcategory: match.competition.code,
      description: `${match.competition.name} fixture sourced from football-data.org.`,
      sourceName: "football-data",
      sourceUrl: "https://www.football-data.org/",
      confidence: "high" as const,
      tags: [
        match.competition.name,
        match.competition.code,
        match.homeTeam.name,
        match.awayTeam.name
      ],
      brandSafetyFlags: []
    };
  });

  return {
    name: "football-data",
    moments,
    cache,
    warnings: []
  };
}
