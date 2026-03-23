import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCollectMoments } = vi.hoisted(() => ({
  mockCollectMoments: vi.fn()
}));

vi.mock("@/lib/momentsService", () => ({
  collectMoments: mockCollectMoments
}));

import { GET } from "@/app/api/moments/route";

describe("GET /api/moments", () => {
  beforeEach(() => {
    mockCollectMoments.mockReset();
  });

  it("returns scored moments with numeric score in API output", async () => {
    mockCollectMoments.mockResolvedValue({
      moments: [
        {
          id: "m1",
          sourceId: "s1",
          title: "Moment 1",
          startDateTime: "2026-03-01T10:00:00.000Z",
          timezone: "Europe/London",
          region: "UK",
          category: "events",
          description: "desc",
          sourceName: "Ticketmaster",
          sourceUrl: "https://example.com",
          confidence: "medium",
          tags: [],
          brandSafetyFlags: [],
          score: 91
        }
      ],
      meta: {
        enabledConnectors: ["ticketmaster"],
        skippedConnectors: [],
        cache: { hits: [], misses: ["ticketmaster"] },
        warnings: []
      }
    });

    const response = await GET(
      new Request("http://localhost/api/moments?from=2026-03-01&to=2026-03-10&categories=events")
    );
    const json = (await response.json()) as { moments: Array<{ score: unknown }> };

    expect(response.status).toBe(200);
    expect(typeof json.moments[0]?.score).toBe("number");
  });

  it("passes forceRefresh to collector when refresh=1 is provided", async () => {
    mockCollectMoments.mockResolvedValue({
      moments: [],
      meta: {
        enabledConnectors: [],
        skippedConnectors: [],
        cache: { hits: [], misses: [] },
        warnings: []
      }
    });

    const response = await GET(
      new Request(
        "http://localhost/api/moments?from=2026-03-01&to=2026-03-10&categories=events&refresh=1"
      )
    );

    expect(response.status).toBe(200);
    expect(mockCollectMoments).toHaveBeenCalledWith(
      expect.objectContaining({
        forceRefresh: true
      })
    );
  });

  it("enforces max date range guardrail", async () => {
    const response = await GET(
      new Request("http://localhost/api/moments?from=2026-01-01&to=2026-05-15&categories=events")
    );
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Date range too large");
    expect(mockCollectMoments).not.toHaveBeenCalled();
  });
});
