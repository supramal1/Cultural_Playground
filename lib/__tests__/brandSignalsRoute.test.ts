import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/brand-signals/route";

describe("POST /api/brand-signals", () => {
  it("returns deterministic empty payload when brand is missing", async () => {
    const request = new Request("http://localhost/api/brand-signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "v2",
        brief: {
          audienceKeyword: "gen z",
          from: "2026-02-01",
          to: "2026-03-01"
        }
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      ok: boolean;
      brandSignals: {
        brandThemes: string[];
        brandAdjacencyKeywords: string[];
        queriesUsed: string[];
        warnings: string[];
      };
      meta: {
        skipped: boolean;
        version: string;
      };
    };

    expect(json.ok).toBe(true);
    expect(json.meta.version).toBe("v2");
    expect(json.meta.skipped).toBe(true);
    expect(json.brandSignals.brandThemes).toEqual([]);
    expect(json.brandSignals.brandAdjacencyKeywords).toEqual([]);
    expect(json.brandSignals.queriesUsed).toEqual([]);
    expect(json.brandSignals.warnings[0]).toContain("Brand missing");
  });
});
