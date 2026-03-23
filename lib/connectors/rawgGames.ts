import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://api.rawg.io/api";

type RawgPlatformEntry = {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
};

type RawgGenre = {
  id: number;
  name: string;
  slug: string;
};

type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  tba: boolean;
  metacritic: number | null;
  rating: number;
  ratings_count: number;
  playtime: number;
  platforms: RawgPlatformEntry[] | null;
  genres: RawgGenre[] | null;
};

type RawgGamesResponse = {
  count: number;
  next: string | null;
  results: RawgGame[];
};

const PAGE_LIMIT = 2;

function isHighProfile(game: RawgGame): boolean {
  return (game.metacritic !== null && game.metacritic >= 75) || game.ratings_count >= 100;
}

export async function collectRawgGames(
  params: ConnectorParams,
  apiKey: string
): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "rawg-games",
    params: {
      ...params,
      pageLimit: PAGE_LIMIT
    },
    keyPresent: Boolean(apiKey),
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const games: RawgGame[] = [];
      let nextUrl: string | null = null;

      for (let page = 1; page <= PAGE_LIMIT; page += 1) {
        const query = new URLSearchParams({
          key: apiKey,
          dates: `${params.from},${params.to}`,
          ordering: "-added",
          page_size: "20",
          page: String(page)
        });

        const url = nextUrl || `${API_ROOT}/games?${query.toString()}`;

        const response = await fetchWithRetry(
          url,
          { method: "GET" },
          { timeoutMs: 10_000, retries: 2 }
        );

        const json = (await response.json()) as RawgGamesResponse;
        games.push(...json.results);
        nextUrl = json.next;

        if (!nextUrl) {
          break;
        }
      }

      return games;
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = payload
    .filter((game) => Boolean(game.released) && !game.tba)
    .filter((game) => {
      const releaseTime = new Date(`${game.released}T00:00:00.000Z`).getTime();
      return Number.isFinite(releaseTime) && releaseTime >= fromTime && releaseTime <= toTime;
    })
    .map((game) => {
      const sourceId = `game-${game.id}`;
      const startDateTime = `${game.released}T00:00:00.000Z`;
      const highProfile = isHighProfile(game);

      const platformNames = (game.platforms || []).map((p) => p.platform.slug);
      const genreNames = (game.genres || []).map((g) => g.slug);

      const tags = [
        "game-release",
        ...platformNames.slice(0, 3),
        ...genreNames.slice(0, 3),
        highProfile ? "wide-release-signal" : "limited-release-signal"
      ];

      const metacriticNote = game.metacritic ? ` Metacritic: ${game.metacritic}.` : "";
      const platformNote = platformNames.length > 0 ? ` Platforms: ${(game.platforms || []).map((p) => p.platform.name).join(", ")}.` : "";

      return {
        id: buildMomentId({
          sourceName: "rawg-games",
          sourceId,
          startDateTime,
          title: game.name
        }),
        sourceId,
        title: `${game.name} (game release)`,
        startDateTime,
        timezone: DEFAULT_TIMEZONE,
        region: REGION,
        category: "events" as const,
        subcategory: "gaming",
        description: `Video game release.${metacriticNote}${platformNote}`,
        sourceName: "rawg-games",
        sourceUrl: `https://rawg.io/games/${game.slug}`,
        confidence: (highProfile ? "high" : "medium") as "high" | "medium",
        tags,
        brandSafetyFlags: [] as string[]
      };
    });

  return {
    name: "rawg-games",
    moments,
    cache,
    warnings: []
  };
}
