import { describe, expect, it } from "vitest";
import { applyScores, scoreMoment } from "@/lib/scoring";
import type { Moment } from "@/lib/schemas/moment";

function makeMoment(overrides: Partial<Moment>): Moment {
  return {
    id: "m1",
    sourceId: "source-1",
    title: "Test Moment",
    startDateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    timezone: "Europe/London",
    region: "UK",
    category: "holidays",
    description: "desc",
    sourceName: "source",
    sourceUrl: "https://example.com",
    confidence: "high",
    tags: ["bank-holiday"],
    brandSafetyFlags: [],
    ...overrides
  };
}

describe("scoreMoment", () => {
  it("boosts bank holidays over observances", () => {
    const bankHoliday = makeMoment({ tags: ["bank-holiday"], subcategory: "bank-holiday" });
    const observance = makeMoment({ tags: ["observance"], subcategory: "observance", id: "m2" });

    const a = scoreMoment(bankHoliday, []);
    const b = scoreMoment(observance, []);

    expect(a).toBeGreaterThan(b);
  });

  it("applies keyword boosts across title and tags", () => {
    const match = makeMoment({ title: "Arsenal Derby", tags: ["premier-league"] });
    const without = scoreMoment(match, []);
    const withKeywords = scoreMoment(match, ["arsenal", "premier"]);

    expect(withKeywords).toBeGreaterThan(without);
  });

  it("includes scoreBreakdown fields in applyScores output", () => {
    const [scored] = applyScores([makeMoment({})], ["arsenal"]);
    expect(scored.scoreBreakdown).toBeDefined();
    expect(typeof scored.scoreBreakdown?.proximityBoost).toBe("number");
    expect(typeof scored.scoreBreakdown?.majorBoost).toBe("number");
    expect(typeof scored.scoreBreakdown?.keywordBoost).toBe("number");
    expect(typeof scored.scoreBreakdown?.confidenceBoost).toBe("number");
  });
});
