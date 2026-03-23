import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { mockGenerateExternalContext } = vi.hoisted(() => ({
  mockGenerateExternalContext: vi.fn()
}));

vi.mock("@/lib/contextService", () => ({
  generateExternalContext: mockGenerateExternalContext,
  ContextRequestSchema: z.object({
    moments: z.array(z.object({ id: z.string(), score: z.number() })).min(1),
    synthesis: z.unknown().optional(),
    brand: z.string().optional(),
    audience: z.string().optional(),
    brandConstraints: z.string().optional(),
    includeAll: z.boolean().optional().default(false)
  })
}));

import { POST } from "@/app/api/context/route";

describe("POST /api/context", () => {
  beforeEach(() => {
    mockGenerateExternalContext.mockReset();
    process.env.PERPLEXITY_API_KEY = "test-key";
  });

  it("returns 400 when key is missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;

    const response = await POST(
      new Request("http://localhost/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments: [{ id: "m1", score: 10 }] })
      })
    );

    const json = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(json.error).toContain("PERPLEXITY_API_KEY");
  });

  it("returns generated context on success", async () => {
    mockGenerateExternalContext.mockResolvedValue({
      context: {
        summary: "Summary",
        signals: [
          { title: "S1", insight: "I1", implication: "P1" },
          { title: "S2", insight: "I2", implication: "P2" },
          { title: "S3", insight: "I3", implication: "P3" }
        ],
        watchouts: [],
        notes: []
      },
      sources: [{ title: "Source", url: "https://example.com" }],
      usedMoments: [{ id: "m1", score: 10 }]
    });

    const response = await POST(
      new Request("http://localhost/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments: [{ id: "m1", score: 10 }] })
      })
    );

    const json = (await response.json()) as { context?: { summary?: string } };
    expect(response.status).toBe(200);
    expect(json.context?.summary).toBe("Summary");
  });
});
