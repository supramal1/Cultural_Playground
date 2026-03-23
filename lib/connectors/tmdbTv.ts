import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://api.themoviedb.org/3";

type TmdbTvShow = {
  id: number;
  name: string;
  overview: string;
  first_air_date: string;
  popularity: number;
  vote_count: number;
  original_language: string;
  origin_country: string[];
};

type TmdbDiscoverTvResponse = {
  page: number;
  total_pages: number;
  results: TmdbTvShow[];
};

const PAGE_LIMIT = 2;

function hasHighProfileSignal(show: TmdbTvShow): boolean {
  return show.vote_count >= 80 || show.popularity >= 40;
}

export async function collectTmdbTvShows(
  params: ConnectorParams,
  apiKey: string
): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "tmdb-tv",
    params: {
      ...params,
      pageLimit: PAGE_LIMIT
    },
    keyPresent: Boolean(apiKey),
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const shows: TmdbTvShow[] = [];
      let totalPages = 1;

      for (let page = 1; page <= Math.min(totalPages, PAGE_LIMIT); page += 1) {
        const query = new URLSearchParams({
          api_key: apiKey,
          watch_region: "GB",
          include_adult: "false",
          sort_by: "first_air_date.asc",
          "first_air_date.gte": params.from,
          "first_air_date.lte": params.to,
          with_original_language: "en",
          page: String(page)
        });

        const response = await fetchWithRetry(
          `${API_ROOT}/discover/tv?${query.toString()}`,
          { method: "GET" },
          { timeoutMs: 10_000, retries: 2 }
        );

        const json = (await response.json()) as TmdbDiscoverTvResponse;
        totalPages = json.total_pages;
        shows.push(...json.results);
      }

      return shows;
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = payload
    .filter((show) => Boolean(show.first_air_date))
    .filter((show) => {
      const airTime = new Date(`${show.first_air_date}T00:00:00.000Z`).getTime();
      return Number.isFinite(airTime) && airTime >= fromTime && airTime <= toTime;
    })
    .map((show) => {
      const sourceId = `tv-${show.id}`;
      const startDateTime = `${show.first_air_date}T00:00:00.000Z`;
      const highProfile = hasHighProfileSignal(show);
      const tags = [
        "tv-premiere",
        "uk-available",
        show.original_language ? `lang:${show.original_language}` : "",
        highProfile ? "wide-release-signal" : "limited-release-signal"
      ].filter(Boolean);

      return {
        id: buildMomentId({
          sourceName: "tmdb-tv",
          sourceId,
          startDateTime,
          title: show.name
        }),
        sourceId,
        title: `${show.name} (TV premiere)`,
        startDateTime,
        timezone: DEFAULT_TIMEZONE,
        region: REGION,
        category: "film" as const,
        subcategory: "tv",
        description: show.overview || "TV show premiere indexed by TMDB.",
        sourceName: "tmdb-tv",
        sourceUrl: `https://www.themoviedb.org/tv/${show.id}`,
        confidence: "medium" as const,
        tags,
        brandSafetyFlags: []
      };
    });

  return {
    name: "tmdb-tv",
    moments,
    cache,
    warnings: []
  };
}
