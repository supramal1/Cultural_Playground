import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache", () => ({
  withConnectorCache: async <T>(input: { fetcher: () => Promise<T> }) => ({
    payload: await input.fetcher(),
    cache: "miss" as const
  })
}));

import { collectTmdbFilms } from "@/lib/connectors/tmdb";

describe("TMDB connector", () => {
  it("filters movies outside the requested date range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            page: 1,
            total_pages: 1,
            results: [
              {
                id: 1,
                title: "In Range",
                overview: "desc",
                release_date: "2026-03-01",
                popularity: 10,
                vote_count: 10,
                original_language: "en"
              },
              {
                id: 2,
                title: "Out Of Range",
                overview: "desc",
                release_date: "2026-12-12",
                popularity: 10,
                vote_count: 10,
                original_language: "en"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const result = await collectTmdbFilms(
      {
        from: "2026-02-12",
        to: "2026-03-14"
      },
      "fake-key"
    );

    expect(result.moments).toHaveLength(1);
    expect(result.moments[0].title).toBe("In Range");
    vi.unstubAllGlobals();
  });
});
