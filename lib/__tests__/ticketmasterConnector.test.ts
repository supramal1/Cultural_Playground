import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache", () => ({
  withConnectorCache: async <T>(input: { fetcher: () => Promise<T> }) => ({
    payload: await input.fetcher(),
    cache: "miss" as const
  })
}));

import { collectTicketmasterEvents } from "@/lib/connectors/ticketmaster";

describe("Ticketmaster connector", () => {
  it("normalizes Discovery events into moments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          _embedded: {
            events: [
              {
                id: "evt-123",
                name: "Arsenal Live",
                url: "https://www.ticketmaster.co.uk/event/evt-123",
                dates: {
                  start: { dateTime: "2026-05-20T18:00:00Z" }
                },
                classifications: [
                  {
                    segment: { name: "Sports" },
                    genre: { name: "Football" },
                    subGenre: { name: "Premier League" }
                  }
                ],
                _embedded: {
                  venues: [{ name: "Stadium", city: { name: "London" } }]
                }
              }
            ]
          },
          page: { totalPages: 1 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await collectTicketmasterEvents(
      {
        from: "2026-05-20",
        to: "2026-05-21",
        keywords: ["Arsenal", "Premier"],
        city: "London"
      },
      "fake-key"
    );

    expect(result.name).toBe("ticketmaster");
    expect(result.moments).toHaveLength(1);
    expect(result.cache).toBe("miss");
    expect(result.moments[0]).toMatchObject({
      sourceId: "evt-123",
      category: "events",
      sourceName: "Ticketmaster",
      sourceUrl: "https://www.ticketmaster.co.uk/event/evt-123",
      confidence: "medium"
    });
    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(firstUrl).toContain("countryCode=GB");
    expect(firstUrl).toContain("keyword=Arsenal+Premier");
    expect(firstUrl).toContain("city=London");

    vi.unstubAllGlobals();
  });
});
