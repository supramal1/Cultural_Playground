import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithRetry } = vi.hoisted(() => ({
  mockFetchWithRetry: vi.fn()
}));

vi.mock("@/lib/fetchWithRetry", () => ({
  fetchWithRetry: mockFetchWithRetry,
  FetchError: class FetchError extends Error {}
}));

import { synthesizeBlueprint, synthesizeMediaOwnerBrief } from "@/lib/briefBuilder/service";

function mockResponse(payload: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => payload
  };
}

describe("brief builder synthesis pointer validation", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockFetchWithRetry.mockReset();
  });

  it("rejects blueprint pointers outside allowed universe", async () => {
    const output = {
      playgroundId: "football-culture",
      playgroundName: "Football Culture",
      coreIdea: "Core idea",
      whoItsFor: ["Fans", "Planners"],
      cultureCodes: [
        { phrase: "code1", meaning: "m1", evidencePointers: ["signals.googleTrends.topRelatedQueries[999]"] },
        { phrase: "code2", meaning: "m2", evidencePointers: [] },
        { phrase: "code3", meaning: "m3", evidencePointers: [] },
        { phrase: "code4", meaning: "m4", evidencePointers: [] },
        { phrase: "code5", meaning: "m5", evidencePointers: [] }
      ],
      communityMap: [
        { community: "r/soccer", careAbout: "fixtures", evidencePointers: [] },
        { community: "r/gunners", careAbout: "lineups", evidencePointers: [] },
        { community: "r/premierleague", careAbout: "rivalry", evidencePointers: [] }
      ],
      tensionsTruths: ["t1", "t2", "t3"],
      brandRole: ["r1", "r2"],
      guardrails: ["g1", "g2", "g3", "g4"],
      measurementSuggestions: ["m1", "m2", "m3"],
      proofOfUseSummary: {
        usedSources: ["Signals"],
        evidencePointers: ["signals.googleTrends.topRelatedQueries[999]"],
        notes: []
      },
      notes: []
    };

    mockFetchWithRetry
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }))
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }));

    await expect(
      synthesizeBlueprint({
        version: "v2",
        mode: "blueprint",
        brief: {
          brand: "Acme",
          objective: "awareness",
          audienceKeyword: "football fans",
          from: "2026-02-01",
          to: "2026-03-01"
        },
        chosenPlayground: {
          id: "football-culture",
          name: "Football Culture",
          definition: "football",
          whyNow: "why",
          fitScore: 80,
          demandScore: 70,
          conversationScore: 65,
          riskFlags: [],
          evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"],
          keywords: {
            core: ["football"],
            expansion: ["tickets"],
            negative: []
          },
          communities: { subreddits: ["soccer"] },
          recommendedCategories: ["sports"],
          notes: []
        },
        signals: {
          meta: {
            generatedAt: new Date().toISOString(),
            inputs: { keywords: ["football"] },
            providers: {
              googleTrends: { status: "OK", ms: 10, cache: "miss", items: 1 },
              reddit: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 },
              wikimedia: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 },
              guardian: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 }
            }
          },
          googleTrends: {
            topRelatedQueries: [{ query: "football", type: "rising", value: 70 }],
            topRelatedTopics: [],
            interestOverTime: [],
            sources: [{ name: "GoogleTrends", url: "https://trends.google.com" }]
          },
          warnings: []
        }
      })
    ).rejects.toMatchObject({
      invalidPointers: expect.arrayContaining(["signals.googleTrends.topRelatedQueries[999]"])
    });
  });

  it("rejects brief pointers outside allowed universe", async () => {
    const output = {
      briefOneLiner: "line",
      objectiveKpi: "obj",
      audienceMindset: "mindset",
      playgroundDefinitionCodes: "codes",
      theAsk: "ask",
      deliverables: ["d1", "d2", "d3"],
      timing: { leadInDays: 7, peakDays: 3, coolDownDays: 5 },
      guardrails: ["g1", "g2", "g3", "g4"],
      proofAppendix: {
        citations: ["c1", "c2", "c3"],
        signalBullets: ["s1", "s2", "s3"],
        evidencePointers: ["signals.reddit.topPosts[99]"]
      },
      momentsToBuildAround: [
        {
          momentId: "mom1",
          actionBullets: ["a1"],
          evidencePointers: ["signals.reddit.topPosts[99]"]
        }
      ],
      notes: []
    };

    mockFetchWithRetry
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }))
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }));

    await expect(
      synthesizeMediaOwnerBrief({
        version: "v2",
        mode: "brief",
        brief: {
          brand: "Acme",
          objective: "awareness",
          audienceKeyword: "football fans",
          from: "2026-02-01",
          to: "2026-03-01"
        },
        blueprint: {
          playgroundId: "football-culture",
          playgroundName: "Football Culture",
          coreIdea: "core",
          whoItsFor: ["w1", "w2"],
          cultureCodes: [
            { phrase: "c1", meaning: "m1", evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"] },
            { phrase: "c2", meaning: "m2", evidencePointers: [] },
            { phrase: "c3", meaning: "m3", evidencePointers: [] },
            { phrase: "c4", meaning: "m4", evidencePointers: [] },
            { phrase: "c5", meaning: "m5", evidencePointers: [] }
          ],
          communityMap: [
            { community: "r/soccer", careAbout: "fixtures", evidencePointers: [] },
            { community: "r/gunners", careAbout: "lineups", evidencePointers: [] },
            { community: "r/premierleague", careAbout: "rivalry", evidencePointers: [] }
          ],
          tensionsTruths: ["t1", "t2", "t3"],
          brandRole: ["r1", "r2"],
          guardrails: ["g1", "g2", "g3", "g4"],
          measurementSuggestions: ["m1", "m2", "m3"],
          proofOfUseSummary: {
            usedSources: ["Signals"],
            evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"],
            notes: []
          },
          notes: []
        },
        selectedOpportunities: [
          {
            id: "mom1",
            sourceId: "mom1",
            title: "Arsenal v Spurs",
            startDateTime: "2026-02-10T20:00:00.000Z",
            timezone: "Europe/London",
            region: "UK",
            category: "sports",
            description: "fixture",
            sourceName: "football-data",
            sourceUrl: "https://example.com/m1",
            confidence: "high",
            tags: ["Arsenal"],
            brandSafetyFlags: [],
            score: 88,
            baseScore: 80,
            finalScore: 88,
            signalBoost: { trends: 4, reddit: 2, wiki: 2, total: 8 },
            evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"]
          }
        ]
      })
    ).rejects.toMatchObject({
      invalidPointers: expect.arrayContaining(["signals.reddit.topPosts[99]"])
    });
  });
});
