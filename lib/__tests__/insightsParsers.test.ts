import { describe, expect, it } from "vitest";
import { parseAudienceCsv } from "@/lib/insights/parseAudienceCsv";
import { parseSearchCsv } from "@/lib/insights/parseSearchCsv";
import { combineKeywordSets } from "@/lib/insights/deriveKeywords";
import { findHeaderRowIndex, parseCsvRows } from "@/lib/insights/utils";

const audienceCsv = [
  "# Download date: 2026-02-12",
  "# Location: United Kingdom",
  "# Time frame: Last 12 months",
  "Area,Sub Area,Item,Share,Baseline share,Index,Relevance,URL",
  "Composition,Gender,Female,51%,49%,104,0.72,",
  "Composition,Age,25-34,24%,20%,120,0.83,",
  "Interests,Sports,Premier League,12%,8%,150,0.94,https://example.com/pl",
  "Interests,Entertainment,Marvel,10%,7%,142,0.89,https://example.com/marvel",
  "Interests,Tech,Gaming,9%,6%,136,0.82,https://example.com/gaming"
].join("\n");

const searchCsv = [
  "# Download date: 2026-02-12",
  "# Location: United Kingdom",
  "# Time frame: Last 12 months",
  "Month start date,Item type,Item,Query trend,Indexed searches,Monthly search volume,YoY Growth for total searches,MoM Growth for total searches",
  "2025-12-01,Category (Indexed),Culture,,72,,12%,4%",
  "2026-01-01,Category (Indexed),Culture,,81,,18%,6%",
  "2026-02-01,Query,arsenal kit,Fast Rising,64,12000,,",
  "2026-02-01,Query,marvel movie,Top,57,9050,,",
  "2026-02-01,Query,liverpool tickets,Sustained Growth,52,8000,,",
  "2026-02-01,Query,bank holiday travel,Emerging,49,7300,,"
].join("\n");

describe("insights parsers", () => {
  it("parses audience CSV and derives capped seed keywords", () => {
    const parsed = parseAudienceCsv(audienceCsv);

    expect(parsed.insights.topAffinities.length).toBeGreaterThan(0);
    expect(parsed.insights.derived.seedKeywords.length).toBeGreaterThan(0);
    expect(parsed.insights.derived.seedKeywords.length).toBeLessThanOrEqual(25);
  });

  it("parses search CSV and derives latest-month query buckets", () => {
    const parsed = parseSearchCsv(searchCsv);

    expect(parsed.insights.queriesLatestMonth.monthStart).toBe("2026-02-01");
    expect(parsed.insights.queriesLatestMonth.byTrend.fastRising.length).toBeGreaterThan(0);
    expect(parsed.insights.derived.seedKeywords.length).toBeGreaterThan(0);
    expect(parsed.insights.derived.seedKeywords.length).toBeLessThanOrEqual(25);
  });

  it("detects headers correctly when metadata lines exist", () => {
    const rows = parseCsvRows(searchCsv);
    const headerRow = findHeaderRowIndex(rows, ["Month start date", "Item type", "Item"]);
    expect(headerRow).toBeGreaterThanOrEqual(0);
  });

  it("combines keywords with dedupe and cap", () => {
    const combined = combineKeywordSets({
      userKeywords: ["Arsenal", "arsenal", "Liverpool"],
      audienceKeywords: ["Marvel", "Gaming", "LIVERPOOL"],
      searchKeywords: ["bank holiday travel", "arsenal"],
      cap: 4
    });

    expect(combined.combined.length).toBeLessThanOrEqual(4);
    expect(new Set(combined.combined.map((item) => item.toLowerCase())).size).toBe(
      combined.combined.length
    );
  });
});
