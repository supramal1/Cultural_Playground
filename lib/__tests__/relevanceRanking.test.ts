import { afterEach, describe, expect, it, vi } from "vitest";
import { rerankMomentsWithLlm } from "@/lib/relevanceRankingService";
import type { ScoredMoment } from "@/lib/schemas/moment";

function makeMoment(id: string, title: string, score = 100): ScoredMoment {
  return {
    id,
    sourceId: id,
    title,
    startDateTime: "2026-03-01T10:00:00.000Z",
    timezone: "Europe/London",
    region: "UK",
    category: "events",
    description: "desc",
    sourceName: "Ticketmaster",
    sourceUrl: "https://example.com",
    confidence: "medium",
    tags: ["sport"],
    brandSafetyFlags: [],
    score
  };
}

function mockOpenAiRelevance(items: Array<{ id: string; relevance: number }>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({ items })
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    )
  );
}

describe("rerankMomentsWithLlm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("filters low-relevance items when keywords are provided", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const moments = [
      makeMoment("m1", "Arsenal fixture"),
      makeMoment("m2", "General event"),
      makeMoment("m3", "Unrelated event"),
      makeMoment("m4", "Another unrelated event"),
      makeMoment("m5", "Low relevance event")
    ];

    mockOpenAiRelevance([
      { id: "m1", relevance: 95 },
      { id: "m2", relevance: 50 },
      { id: "m3", relevance: 20 },
      { id: "m4", relevance: 10 },
      { id: "m5", relevance: 5 }
    ]);

    const result = await rerankMomentsWithLlm({
      moments,
      keywords: ["arsenal"],
      audience: "football fans"
    });

    expect(result.moments).toHaveLength(2);
    expect(result.moments.map((moment) => moment.id)).toEqual(["m1", "m2"]);
    expect(result.warning).toContain("keyword filtering");
  });

  it("keeps all items for audience-only reranking", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const moments = [makeMoment("m1", "Event 1"), makeMoment("m2", "Event 2"), makeMoment("m3", "Event 3")];

    mockOpenAiRelevance([
      { id: "m1", relevance: 10 },
      { id: "m2", relevance: 20 },
      { id: "m3", relevance: 30 }
    ]);

    const result = await rerankMomentsWithLlm({
      moments,
      keywords: [],
      audience: "Gen Z"
    });

    expect(result.moments).toHaveLength(3);
    expect(result.warning).toContain("reranking");
  });
});
