import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateSignals, mockCollectMoments, mockCollectWikimediaSignals, mockGenerateBrandSignals } = vi.hoisted(() => ({
  mockGenerateSignals: vi.fn(),
  mockCollectMoments: vi.fn(),
  mockCollectWikimediaSignals: vi.fn(),
  mockGenerateBrandSignals: vi.fn()
}));

vi.mock("@/lib/signals/service", () => ({
  generateSignals: mockGenerateSignals
}));

vi.mock("@/lib/momentsService", () => ({
  collectMoments: mockCollectMoments
}));

vi.mock("@/lib/signals/providers/wikimedia", () => ({
  collectWikimediaSignals: mockCollectWikimediaSignals
}));

vi.mock("@/lib/brandSignals/service", () => ({
  generateBrandSignals: mockGenerateBrandSignals
}));

import { buildPlanData, discoverPlaygrounds } from "@/lib/playground/engine";

function mockSignalsResponse() {
  return {
    signals: {
      meta: {
        generatedAt: new Date().toISOString(),
        inputs: { keywords: ["football"] },
        providers: {
          googleTrends: { status: "OK", ms: 10, cache: "miss", items: 2 },
          reddit: { status: "OK", ms: 12, cache: "miss", items: 3 },
          wikimedia: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 },
          guardian: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 }
        }
      },
      googleTrends: {
        topRelatedQueries: [{ query: "arsenal", type: "rising", value: 70 }],
        topRelatedTopics: [],
        interestOverTime: [],
        sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
      },
      reddit: {
        subredditCandidates: [{ name: "Gunners", reason: "match" }],
        topPosts: [
          {
            title: "Arsenal transfer latest",
            subreddit: "Gunners",
            url: "https://reddit.com/r/gunners/post1",
            score: 100,
            comments: 20,
            createdUtc: 1710000000
          }
        ],
        commonThemes: ["arsenal", "transfers"],
        sources: [{ name: "Reddit", url: "https://reddit.com" }]
      },
      warnings: []
    },
    cache: "miss",
    providers: {
      googleTrends: { status: "OK", ms: 10, cache: "miss", items: 2 },
      reddit: { status: "OK", ms: 12, cache: "miss", items: 3 },
      wikimedia: { status: "SKIPPED", ms: 0, cache: "n/a", items: 0 }
    }
  };
}

describe("playground engine", () => {
  beforeEach(() => {
    mockGenerateSignals.mockReset();
    mockCollectMoments.mockReset();
    mockCollectWikimediaSignals.mockReset();
    mockGenerateBrandSignals.mockReset();
    mockGenerateSignals.mockResolvedValue(mockSignalsResponse());
    mockGenerateBrandSignals.mockResolvedValue({
      brandSignals: {
        brandThemes: [],
        brandAdjacencyKeywords: [],
        brandSubreddits: [],
        brandRiskFlags: [],
        queriesUsed: [],
        queryDiagnostics: [],
        evidencePointers: [],
        warnings: []
      },
      meta: {
        cache: "miss",
        skipped: true,
        includePerplexity: false,
        queriesUsed: [],
        queryStrategy: {
          phaseA: {
            redditQueries: [],
            redditQueryCap: 3,
            redditPostCap: 15,
            perplexityAttempted: false
          }
        },
        warnings: []
      }
    });
  });

  it("returns deterministic 3-5 candidates from discovery", async () => {
    const input = {
      version: "v2" as const,
      brief: {
        audienceKeyword: "football fans",
        from: "2026-02-01",
        to: "2026-03-01",
        boostKeywords: ["Arsenal", "Premier League"]
      },
      insights: {
        search: {
          meta: {},
          timeSeries: [],
          queriesLatestMonth: {
            monthStart: "2026-02-01",
            byTrend: {
              top: [],
              fastRising: [{ query: "Arsenal tickets", trend: "Fast Rising" }],
              sustainedGrowth: [],
              emerging: [],
              declining: []
            }
          },
          derived: {
            seedKeywords: ["Arsenal", "Premier League"],
            negativeKeywords: []
          }
        }
      },
      options: {
        skipDiscoverySignals: true,
        maxCandidates: 5
      }
    };

    const first = await discoverPlaygrounds(input);
    const second = await discoverPlaygrounds(input);

    expect(first.candidates.length).toBeGreaterThanOrEqual(3);
    expect(first.candidates.length).toBeLessThanOrEqual(5);
    expect(first.candidates.map((item) => item.id)).toEqual(second.candidates.map((item) => item.id));
    const footballCandidate = first.candidates.find((item) => item.id === "football-culture");
    expect(footballCandidate?.fitScore).toBeGreaterThanOrEqual(40);
    expect(first.meta.queryStrategy.phaseB).toBeTruthy();
    expect(first.meta.queryStrategy.phaseB.trendsTermsPerCandidateCap).toBe(2);
  });

  it("caps discovery signals to 2 keywords per candidate", async () => {
    const result = await discoverPlaygrounds({
      version: "v2",
      brief: {
        audienceKeyword: "football fans",
        from: "2026-02-01",
        to: "2026-03-01",
        boostKeywords: ["Arsenal", "Premier League", "Chelsea", "Liverpool"]
      },
      options: {
        skipDiscoverySignals: false,
        maxCandidates: 3
      }
    });

    expect(mockGenerateSignals).toHaveBeenCalled();
    for (const call of mockGenerateSignals.mock.calls) {
      const payload = call[0] as { keywords?: string[]; maxKeywords?: number };
      expect((payload.keywords || []).length).toBeLessThanOrEqual(2);
      expect(payload.maxKeywords).toBe(2);
    }

    const querySignatures = new Set(
      mockGenerateSignals.mock.calls.map((call) => ((call[0] as { keywords?: string[] }).keywords || []).join("|"))
    );
    expect(querySignatures.size).toBeGreaterThan(1);
    result.candidates.forEach((candidate) => {
      expect(candidate.demandScore).toBeLessThan(100);
      expect(candidate.conversationScore).toBeLessThan(100);
      expect(candidate.categoryBaseline).toBeTruthy();
      expect(candidate.evidenceQa).toBeTruthy();
      expect(candidate.evidenceQa?.sampleSize.totalSignals).toBeGreaterThanOrEqual(0);
      expect(["high", "medium", "low"]).toContain(candidate.evidenceQa?.confidenceBand);
    });
  });

  it("changes candidate ordering when brand adjacency keywords change", async () => {
    const baseInput = {
      version: "v2" as const,
      brief: {
        brand: "Acme",
        objective: "awareness",
        audienceKeyword: "uk fans",
        from: "2026-02-01",
        to: "2026-03-01",
        boostKeywords: ["community"]
      },
      options: {
        skipDiscoverySignals: true,
        maxCandidates: 3,
        includePerplexity: false
      }
    };

    mockGenerateBrandSignals.mockResolvedValueOnce({
      brandSignals: {
        brandThemes: ["football", "premier league"],
        brandAdjacencyKeywords: ["football", "premier league", "stadium"],
        brandSubreddits: ["soccer"],
        brandRiskFlags: [],
        queriesUsed: ["Acme"],
        queryDiagnostics: [],
        evidencePointers: [],
        warnings: []
      },
      meta: {
        cache: "miss",
        skipped: false,
        includePerplexity: false,
        queriesUsed: ["Acme"],
        queryStrategy: {
          phaseA: {
            redditQueries: ["Acme"],
            redditQueryCap: 3,
            redditPostCap: 15,
            perplexityAttempted: false
          }
        },
        warnings: []
      }
    });

    const footballResult = await discoverPlaygrounds(baseInput);

    mockGenerateBrandSignals.mockResolvedValueOnce({
      brandSignals: {
        brandThemes: ["film", "cinema"],
        brandAdjacencyKeywords: ["film", "cinema", "streaming"],
        brandSubreddits: ["movies"],
        brandRiskFlags: [],
        queriesUsed: ["Acme"],
        queryDiagnostics: [],
        evidencePointers: [],
        warnings: []
      },
      meta: {
        cache: "miss",
        skipped: false,
        includePerplexity: false,
        queriesUsed: ["Acme"],
        queryStrategy: {
          phaseA: {
            redditQueries: ["Acme"],
            redditQueryCap: 3,
            redditPostCap: 15,
            perplexityAttempted: false
          }
        },
        warnings: []
      }
    });

    const filmResult = await discoverPlaygrounds(baseInput);

    expect(footballResult.candidates[0].id).not.toBe(filmResult.candidates[0].id);
  });

  it("caps plan signals to 12 and only boosts existing moments with wiki matches", async () => {
    mockCollectMoments.mockResolvedValue({
      moments: [
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
          score: 70
        },
        {
          id: "mom2",
          sourceId: "mom2",
          title: "London Film Premiere",
          startDateTime: "2026-02-11T20:00:00.000Z",
          timezone: "Europe/London",
          region: "UK",
          category: "film",
          description: "premiere",
          sourceName: "tmdb",
          sourceUrl: "https://example.com/m2",
          confidence: "high",
          tags: ["Cinema"],
          brandSafetyFlags: [],
          score: 65
        }
      ],
      meta: {
        enabledConnectors: ["football-data", "tmdb"],
        skippedConnectors: [],
        cache: { hits: [], misses: [] },
        warnings: []
      }
    });

    mockCollectWikimediaSignals.mockResolvedValue({
      data: {
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
    });

    const plan = await buildPlanData({
      version: "v2",
      brief: {
        audienceKeyword: "football fans",
        from: "2026-02-01",
        to: "2026-03-01",
        categories: ["sports", "film"],
        boostKeywords: ["Arsenal", "Premier League", "Football", "Tickets"]
      },
      chosenPlayground: {
        playgroundId: "football-culture"
      }
    });

    const signalCall = mockGenerateSignals.mock.calls.find((call) => (call[0] as { maxKeywords?: number }).maxKeywords === 12);
    expect(signalCall).toBeTruthy();
    const signalPayload = signalCall?.[0] as { keywords: string[]; maxKeywords: number };
    expect(signalPayload.maxKeywords).toBe(12);
    expect(signalPayload.keywords.length).toBeLessThanOrEqual(12);
    expect(plan.meta.queryStrategy).toBeTruthy();
    expect((plan.meta.queryStrategy as { phaseC?: { signalTermCap?: number } }).phaseC?.signalTermCap).toBe(12);

    expect(plan.moments.length).toBe(2);
    const arsenal = plan.moments.find((moment) => moment.id === "mom1");
    const film = plan.moments.find((moment) => moment.id === "mom2");
    expect(typeof arsenal?.baseScore).toBe("number");
    expect(typeof arsenal?.finalScore).toBe("number");
    expect(typeof arsenal?.signalBoost.total).toBe("number");
    expect(plan.moments[0].finalScore).toBeGreaterThanOrEqual(plan.moments[1].finalScore);
    expect(arsenal?.signalBoost.wiki).toBeGreaterThan(0);
    expect(film?.signalBoost.wiki).toBe(0);
  });
});
