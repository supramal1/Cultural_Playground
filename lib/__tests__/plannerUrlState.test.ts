import { describe, expect, it } from "vitest";
import { buildPlannerUrlSearch, parsePlannerUrlState } from "@/lib/plannerUrlState";

describe("planner URL state", () => {
  it("parses supported filters", () => {
    const parsed = parsePlannerUrlState(
      "?from=2026-02-12&to=2026-03-12&categories=sports,film&brand=Nike&boost=arsenal&audience=Gen%20Z&sort=date&planner=1&confidence=high&weekends=1"
    );

    expect(parsed).toMatchObject({
      from: "2026-02-12",
      to: "2026-03-12",
      categories: ["sports", "film"],
      brand: "Nike",
      boost: "arsenal",
      audience: "Gen Z",
      sort: "date",
      planner: true,
      confidence: "high",
      weekendsOnly: true
    });
  });

  it("builds a stable search string", () => {
    const search = buildPlannerUrlSearch({
      from: "2026-02-12",
      to: "2026-03-12",
      categories: ["sports", "film"],
      brand: "Nike",
      boost: "arsenal,liverpool",
      audience: "Gen Z",
      sort: "relevance",
      planner: true,
      confidence: "high"
    });

    expect(search).toBe(
      "?from=2026-02-12&to=2026-03-12&categories=sports%2Cfilm&boost=arsenal%2Cliverpool&brand=Nike&audience=Gen+Z&sort=relevance&planner=1&confidence=high"
    );
  });
});
