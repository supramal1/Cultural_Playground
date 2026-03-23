import { describe, expect, it } from "vitest";
import { MomentSchema, ScoredMomentSchema } from "@/lib/schemas/moment";

const baseMoment = {
  id: "abcd1234",
  sourceId: "source-1",
  title: "Event Title",
  startDateTime: "2026-03-15T19:00:00.000Z",
  timezone: "Europe/London",
  region: "UK",
  category: "sports",
  description: "Fixture",
  sourceName: "football-data",
  sourceUrl: "https://www.football-data.org/",
  confidence: "high",
  tags: ["PL"],
  brandSafetyFlags: []
};

describe("moment schema", () => {
  it("accepts valid moments", () => {
    expect(MomentSchema.safeParse(baseMoment).success).toBe(true);
  });

  it("rejects invalid category", () => {
    const invalid = { ...baseMoment, category: "music" };
    expect(MomentSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts scored moments with numeric score", () => {
    const scored = { ...baseMoment, score: 100 };
    expect(ScoredMomentSchema.safeParse(scored).success).toBe(true);
  });
});
