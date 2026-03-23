import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchWithRetry } = vi.hoisted(() => ({
  mockFetchWithRetry: vi.fn()
}));

vi.mock("@/lib/fetchWithRetry", () => ({
  fetchWithRetry: mockFetchWithRetry,
  FetchError: class FetchError extends Error {}
}));

import { synthesizePlanDataV2 } from "@/lib/synthesisServiceV2";
import type { PlanData } from "@/lib/playground/types";

function mockResponse(payload: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => payload
  };
}

function makePlanData(): PlanData {
  const baseMoment = {
    sourceId: "src",
    timezone: "Europe/London",
    region: "UK",
    description: "desc",
    sourceName: "ticketmaster",
    sourceUrl: "https://example.com",
    confidence: "high" as const,
    tags: ["arsenal"],
    brandSafetyFlags: [],
    scoreBreakdown: {
      proximityBoost: 50,
      majorBoost: 20,
      keywordBoost: 10,
      confidenceBoost: 8
    },
    signalBoost: {
      trends: 4,
      reddit: 3,
      wiki: 2,
      total: 9
    }
  };

  return {
    playground: {
      candidate: {
        id: "football-culture",
        name: "Football Culture",
        definition: "Football fans and fixtures",
        whyNow: "Demand and conversation are active.",
        fitScore: 80,
        demandScore: 70,
        conversationScore: 65,
        riskFlags: [],
        evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"],
        keywords: {
          core: ["arsenal", "premier league"],
          expansion: ["tickets"],
          negative: []
        },
        communities: { subreddits: ["Gunners"] },
        recommendedCategories: ["sports"],
        notes: []
      }
    },
    moments: [
      {
        ...baseMoment,
        id: "mom1",
        sourceId: "mom1",
        title: "Arsenal v Spurs",
        startDateTime: "2026-02-10T20:00:00.000Z",
        category: "sports",
        baseScore: 80,
        finalScore: 89,
        score: 89,
        evidencePointers: ["signals.wikimedia.entities[0]", "signals.googleTrends.topRelatedQueries[0]"],
        signalMatch: {
          momentId: "mom1",
          matched: {
            trends: [{ label: "arsenal", pointer: "signals.googleTrends.topRelatedQueries[0]" }],
            reddit: [{ label: "arsenal", pointer: "signals.reddit.commonThemes[0]" }],
            wiki: [{ entity: "Arsenal", pointer: "signals.wikimedia.entities[0]" }]
          },
          signalBoost: { trends: 4, reddit: 3, wiki: 2, total: 9 },
          evidencePointers: ["signals.wikimedia.entities[0]", "signals.googleTrends.topRelatedQueries[0]"]
        }
      },
      {
        ...baseMoment,
        id: "mom2",
        sourceId: "mom2",
        title: "Premier League preview",
        startDateTime: "2026-02-11T20:00:00.000Z",
        category: "sports",
        baseScore: 70,
        finalScore: 76,
        score: 76,
        evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"]
      },
      {
        ...baseMoment,
        id: "mom3",
        sourceId: "mom3",
        title: "Fan Zone Event",
        startDateTime: "2026-02-12T20:00:00.000Z",
        category: "events",
        baseScore: 65,
        finalScore: 70,
        score: 70,
        evidencePointers: ["signals.reddit.commonThemes[0]"]
      }
    ],
    signals: {
      meta: {
        generatedAt: new Date().toISOString(),
        inputs: { keywords: ["arsenal"] },
        providers: {
          googleTrends: { status: "OK", ms: 10, cache: "miss", items: 1 },
          reddit: { status: "OK", ms: 11, cache: "miss", items: 1 },
          wikimedia: { status: "OK", ms: 8, cache: "miss", items: 1 },
          guardian: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 }
        }
      },
      googleTrends: {
        topRelatedQueries: [{ query: "arsenal", type: "rising", value: 80 }],
        topRelatedTopics: [],
        interestOverTime: [],
        sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
      },
      reddit: {
        subredditCandidates: [{ name: "Gunners", reason: "match" }],
        topPosts: [
          {
            title: "Arsenal latest",
            subreddit: "Gunners",
            url: "https://reddit.com/r/gunners/1",
            score: 10,
            comments: 2,
            createdUtc: 1710000000
          }
        ],
        commonThemes: ["arsenal"],
        sources: [{ name: "Reddit", url: "https://reddit.com" }]
      },
      wikimedia: {
        entities: [
          {
            title: "Arsenal",
            project: "en.wikipedia",
            views: [{ date: "2026-02-01", views: 100 }],
            total: 100
          }
        ],
        sources: [{ name: "Wikimedia Pageviews", url: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews" }]
      },
      warnings: []
    },
    meta: {
      keywordSetInPlay: ["arsenal"],
      providerStatus: {},
      wikiMatchesCount: 1,
      coverageNotes: [],
      warnings: [],
      version: "v2"
    }
  };
}

describe("synthesis v2", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockFetchWithRetry.mockReset();
  });

  it("rejects evidence pointers not in plan data pointer universe after retry", async () => {
    const output = {
      playground: {
        id: "football-culture",
        name: "Football Culture",
        definition: "desc",
        whyNow: "why",
        evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"]
      },
      executiveAnswer: "Generic answer",
      opportunities: [
        {
          momentId: "mom1",
          whyItMatters: "matters",
          audienceHook: "hook",
          whatToDo: ["Do this"],
          channels: ["social"],
          risks: [],
          evidencePointers: ["signals.wikimedia.entities[99]"]
        }
      ],
      themes: [],
      proofOfUse: {
        usedSources: ["trends", "reddit"],
        topSignalsUsed: ["arsenal"],
        evidence: [
          { statement: "s1", pointers: ["signals.googleTrends.topRelatedQueries[0]"] },
          { statement: "s2", pointers: ["signals.reddit.commonThemes[0]"] },
          { statement: "s3", pointers: ["signals.wikimedia.entities[99]"] }
        ]
      },
      notes: []
    };

    mockFetchWithRetry
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }))
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(output) }));

    await expect(
      synthesizePlanDataV2({
        version: "v2",
        planData: makePlanData()
      })
    ).rejects.toMatchObject({
      invalidPointers: expect.arrayContaining(["signals.wikimedia.entities[99]"])
    });
  });

  it("applies corrective retry to include wikimedia when wiki matches exist", async () => {
    const first = {
      playground: {
        id: "football-culture",
        name: "Football Culture",
        definition: "desc",
        whyNow: "why",
        evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"]
      },
      executiveAnswer: "Generic answer",
      opportunities: [
        {
          momentId: "mom1",
          whyItMatters: "matters",
          audienceHook: "hook",
          whatToDo: ["Do this"],
          channels: ["social"],
          risks: [],
          evidencePointers: ["signals.googleTrends.topRelatedQueries[0]"]
        }
      ],
      themes: [],
      proofOfUse: {
        usedSources: ["trends", "reddit"],
        topSignalsUsed: ["arsenal"],
        evidence: [
          { statement: "s1", pointers: ["signals.googleTrends.topRelatedQueries[0]"] },
          { statement: "s2", pointers: ["signals.reddit.commonThemes[0]"] },
          { statement: "s3", pointers: ["signals.googleTrends.topRelatedQueries[0]"] }
        ]
      },
      notes: []
    };

    const second = {
      ...first,
      opportunities: [
        {
          ...first.opportunities[0],
          evidencePointers: ["signals.wikimedia.entities[0]", "signals.googleTrends.topRelatedQueries[0]"]
        }
      ],
      proofOfUse: {
        ...first.proofOfUse,
        usedSources: ["trends", "reddit", "wikimedia"]
      }
    };

    mockFetchWithRetry
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(first) }))
      .mockResolvedValueOnce(mockResponse({ output_text: JSON.stringify(second) }));

    const result = await synthesizePlanDataV2({
      version: "v2",
      planData: makePlanData()
    });

    expect(result.synthesis.proofOfUse.usedSources).toContain("wikimedia");
    expect(result.synthesis.opportunities[0].evidencePointers).toContain("signals.wikimedia.entities[0]");
  });
});
