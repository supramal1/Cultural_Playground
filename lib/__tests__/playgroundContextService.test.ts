import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithRetry } = vi.hoisted(() => ({
  mockFetchWithRetry: vi.fn()
}));

vi.mock("@/lib/fetchWithRetry", () => ({
  fetchWithRetry: mockFetchWithRetry,
  FetchError: class FetchError extends Error {}
}));

import { generatePlaygroundContext } from "@/lib/playground/perplexityContext";

function makeRequest(seed: string) {
  return {
    brief: {
      brand: `Brand ${seed}`,
      objective: "awareness",
      audienceKeyword: "gen z",
      from: "2026-02-01",
      to: "2026-03-01",
      boostKeywords: ["football"]
    },
    candidates: [
      {
        id: "football-culture",
        name: "Football Culture",
        definition: "Football fandom and fixtures.",
        whyNow: "Momentum exists.",
        fitScore: 80,
        demandScore: 70,
        conversationScore: 70,
        riskFlags: [],
        evidencePointers: [],
        keywords: {
          core: ["football", "premier league"],
          expansion: ["tickets"],
          negative: []
        },
        communities: {
          subreddits: ["soccer"]
        },
        recommendedCategories: ["sports" as const],
        notes: []
      }
    ]
  };
}

describe("playground context service", () => {
  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    mockFetchWithRetry.mockReset();
  });

  it("is best-effort when perplexity fails", async () => {
    mockFetchWithRetry.mockRejectedValue(new Error("perplexity down"));

    const result = await generatePlaygroundContext(makeRequest("best-effort"));

    expect(result.context.byPlaygroundId).toEqual({});
    expect(result.context.warnings[0].toLowerCase()).toContain("perplexity");
  });

  it("uses cache on repeated requests", async () => {
    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  playgroundId: "football-culture",
                  validation: "Validated",
                  anchors: [{ label: "Anchor", url: "https://example.com/anchor" }],
                  safetyNotes: ["Check adjacencies"]
                }
              ]
            })
          }
        }
      ],
      citations: ["https://example.com/citation"]
    };

    mockFetchWithRetry.mockResolvedValue({
      json: async () => payload
    });

    const request = {
      ...makeRequest(`cache-${Date.now()}`),
      options: { refresh: true }
    };

    const first = await generatePlaygroundContext(request);
    expect(first.cache).toBe("miss");

    const second = await generatePlaygroundContext({
      ...request,
      options: { refresh: false }
    });

    expect(second.cache).toBe("hit");
    expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
  });

  it("deduplicates repeated anchor urls across playgrounds", async () => {
    const payload = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  playgroundId: "football-culture",
                  validation: "Validated",
                  anchors: [{ label: "Shared anchor", url: "https://example.com/shared" }],
                  safetyNotes: ["note"]
                },
                {
                  playgroundId: "film-tv-fandom",
                  validation: "Validated",
                  anchors: [{ label: "Shared anchor", url: "https://example.com/shared" }],
                  safetyNotes: ["note"]
                }
              ]
            })
          }
        }
      ]
    };

    mockFetchWithRetry.mockResolvedValue({
      json: async () => payload
    });

    const request = makeRequest(`dedupe-${Date.now()}`);
    request.candidates.push({
      ...request.candidates[0],
      id: "film-tv-fandom",
      name: "Film & TV Fandom",
      definition: "Entertainment fandom"
    });

    const result = await generatePlaygroundContext({
      ...request,
      options: { refresh: true }
    });

    expect(result.context.byPlaygroundId["football-culture"]?.anchors.length).toBe(1);
    expect(result.context.byPlaygroundId["film-tv-fandom"]?.anchors.length).toBe(0);
  });
});
