import { describe, expect, it } from "vitest";
import { dedupeMoments } from "@/lib/dedupe";
import type { Moment } from "@/lib/schemas/moment";

function makeMoment(overrides: Partial<Moment>): Moment {
  return {
    id: "m-1",
    sourceId: "source-1",
    title: "Fixture A",
    startDateTime: "2026-04-01T15:00:00.000Z",
    timezone: "Europe/London",
    region: "UK",
    category: "events",
    description: "desc",
    sourceName: "ticketmaster",
    sourceUrl: "https://example.com",
    confidence: "medium",
    tags: [],
    brandSafetyFlags: [],
    ...overrides
  };
}

describe("dedupeMoments", () => {
  it("dedupes by sourceName+sourceId, keeps earliest startDateTime, and merges tags", () => {
    const earliest = makeMoment({
      id: "id-earliest",
      title: "Earlier",
      sourceName: "ticketmaster",
      sourceId: "evt-1",
      startDateTime: "2026-04-01T10:00:00.000Z",
      tags: ["music", "uk"]
    });
    const later = makeMoment({
      id: "id-later",
      title: "Later",
      sourceName: "ticketmaster",
      sourceId: "evt-1",
      startDateTime: "2026-04-01T12:00:00.000Z",
      tags: ["uk", "festival"]
    });

    const deduped = dedupeMoments([later, earliest]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].startDateTime).toBe("2026-04-01T10:00:00.000Z");
    expect(deduped[0].tags.sort()).toEqual(["festival", "music", "uk"]);
  });
});
