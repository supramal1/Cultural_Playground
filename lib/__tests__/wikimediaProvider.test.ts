import { afterEach, describe, expect, it, vi } from "vitest";
import { collectWikimediaSignals } from "@/lib/signals/providers/wikimedia";

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.WIKIMEDIA_ACCESS_TOKEN;
  delete process.env.WIKIMEDIA_CLIENT_ID;
  delete process.env.WIKIMEDIA_CLIENT_SECRET;
});

describe("wikimedia signals provider", () => {
  it("builds pageviews request and normalizes totals", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2/access_token")) {
        return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
      }

      return new Response(
        JSON.stringify({
          items: [
            { timestamp: "2026020100", views: 11 },
            { timestamp: "2026020200", views: 19 }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await collectWikimediaSignals({
      keywords: ["Premier League"],
      from: "2026-02-01",
      to: "2026-02-02"
    });

    expect(fetchMock).toHaveBeenCalled();
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("wikimedia.org/api/rest_v1/metrics/pageviews/per-article");
    expect(firstUrl).toContain("Premier_League");

    expect(result.data?.entities.length).toBe(1);
    expect(result.data?.entities[0]?.total).toBe(30);
    expect(result.data?.entities[0]?.views[0]?.date).toBe("2026-02-01");
  });
});
