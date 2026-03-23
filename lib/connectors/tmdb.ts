import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://api.themoviedb.org/3";

type TmdbMovie = {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  popularity: number;
  vote_count: number;
  original_language: string;
};

type TmdbDiscoverResponse = {
  page: number;
  total_pages: number;
  results: TmdbMovie[];
};

const PAGE_LIMIT = 3;

function hasWideReleaseSignal(movie: TmdbMovie): boolean {
  return movie.vote_count >= 120 || movie.popularity >= 50;
}

export async function collectTmdbFilms(
  params: ConnectorParams,
  apiKey: string
): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "tmdb-films",
    params: {
      ...params,
      pageLimit: PAGE_LIMIT
    },
    keyPresent: Boolean(apiKey),
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const movies: TmdbMovie[] = [];
      let totalPages = 1;

      for (let page = 1; page <= Math.min(totalPages, PAGE_LIMIT); page += 1) {
        const query = new URLSearchParams({
          api_key: apiKey,
          region: "GB",
          include_adult: "false",
          sort_by: "primary_release_date.asc",
          "primary_release_date.gte": params.from,
          "primary_release_date.lte": params.to,
          page: String(page)
        });

        const response = await fetchWithRetry(
          `${API_ROOT}/discover/movie?${query.toString()}`,
          {
            method: "GET"
          },
          { timeoutMs: 10_000, retries: 2 }
        );

        const json = (await response.json()) as TmdbDiscoverResponse;
        totalPages = json.total_pages;
        movies.push(...json.results);
      }

      return movies;
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = payload
    .filter((movie) => Boolean(movie.release_date))
    .filter((movie) => {
      const releaseTime = new Date(`${movie.release_date}T00:00:00.000Z`).getTime();
      return Number.isFinite(releaseTime) && releaseTime >= fromTime && releaseTime <= toTime;
    })
    .map((movie) => {
      const sourceId = String(movie.id);
      const startDateTime = `${movie.release_date}T00:00:00.000Z`;
      const wideReleaseSignal = hasWideReleaseSignal(movie);
      const tags = [
        "uk-release",
        movie.original_language ? `lang:${movie.original_language}` : "",
        wideReleaseSignal ? "wide-release-signal" : "limited-release-signal"
      ].filter(Boolean);

      return {
        id: buildMomentId({
          sourceName: "tmdb",
          sourceId,
          startDateTime,
          title: movie.title
        }),
        sourceId,
        title: movie.title,
        startDateTime,
        timezone: DEFAULT_TIMEZONE,
        region: REGION,
        category: "film" as const,
        description: movie.overview || "Film release indexed by TMDB.",
        sourceName: "tmdb",
        sourceUrl: `https://www.themoviedb.org/movie/${movie.id}`,
        confidence: "medium" as const,
        tags,
        brandSafetyFlags: []
      };
    });

  return {
    name: "tmdb-films",
    moments,
    cache,
    warnings: []
  };
}
