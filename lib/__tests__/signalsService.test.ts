import { afterEach, describe, expect, it, vi } from "vitest";
import { selectSignalKeywords, generateSignals } from "@/lib/signals/service";
import { SignalsBundleSchema } from "@/lib/signals/types";

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("signals service", () => {
  it("caps and dedupes signal keywords deterministically", () => {
    const selected = selectSignalKeywords({
      keywords: ["Arsenal", "arsenal", "Liverpool", "Marvel", "Gaming"],
      maxKeywords: 3
    });

    expect(selected).toEqual(["Arsenal", "Liverpool", "Marvel"]);
  });

  it("returns valid bundle when providers are disabled", async () => {
    const result = await generateSignals({
      keywords: ["Arsenal", "Marvel"],
      includeGoogleTrends: false,
      includeReddit: false,
      includeWikimedia: false
    });

    const parsed = SignalsBundleSchema.safeParse(result.signals);
    expect(parsed.success).toBe(true);
    expect(result.signals.meta.inputs.keywords.length).toBeGreaterThan(0);
  });

  it("does not hard-fail when wikimedia provider errors", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const result = await generateSignals({
      keywords: ["Premier League"],
      includeGoogleTrends: false,
      includeReddit: false,
      includeWikimedia: true
    });

    expect(result.signals.wikimedia?.entities || []).toEqual([]);
    expect(result.signals.warnings.some((warning) => warning.toLowerCase().includes("wikimedia"))).toBe(true);
  });
});
