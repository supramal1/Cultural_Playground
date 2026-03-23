import { describe, expect, it } from "vitest";
import { MAX_DATE_RANGE_DAYS } from "@/lib/config";
import { synthesizeMoments } from "@/lib/synthesisService";
import { generateSlide } from "@/lib/slideService";
import type { ScoredMoment } from "@/lib/schemas/moment";

function makeMoment(id: string, startDateTime: string): ScoredMoment {
  return {
    id,
    sourceId: id,
    title: `Moment ${id}`,
    startDateTime,
    timezone: "Europe/London",
    region: "UK",
    category: "events",
    description: "desc",
    sourceName: "ticketmaster",
    sourceUrl: "https://example.com",
    confidence: "medium",
    tags: [],
    brandSafetyFlags: [],
    score: 50
  };
}

describe("LLM guardrails", () => {
  it("enforces max range for synthesis", async () => {
    const moments = [
      makeMoment("m1", "2026-01-01T00:00:00.000Z"),
      makeMoment("m2", "2026-04-15T00:00:00.000Z")
    ];

    await expect(
      synthesizeMoments({
        moments,
        includeAll: false
      })
    ).rejects.toThrow(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  });

  it("enforces max range for slide generation", async () => {
    const moments = [
      makeMoment("m1", "2026-01-01T00:00:00.000Z"),
      makeMoment("m2", "2026-04-15T00:00:00.000Z")
    ];

    await expect(
      generateSlide({
        moments,
        includeAll: false
      })
    ).rejects.toThrow(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  });
});
