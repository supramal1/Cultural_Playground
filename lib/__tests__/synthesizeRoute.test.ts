import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { mockSynthesizeMoments } = vi.hoisted(() => ({
  mockSynthesizeMoments: vi.fn()
}));

vi.mock("@/lib/synthesisService", () => ({
  synthesizeMoments: mockSynthesizeMoments,
  SynthesizeRequestSchema: z.object({
    moments: z.array(z.object({ id: z.string(), score: z.number() })).min(1),
    audience: z.string().optional(),
    brandConstraints: z.string().optional(),
    includeAll: z.boolean().optional().default(false)
  })
}));

import { POST } from "@/app/api/synthesize/route";

describe("POST /api/synthesize", () => {
  beforeEach(() => {
    mockSynthesizeMoments.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns 422 when synthesis references unknown ids after verification", async () => {
    const error = Object.assign(new Error("Invalid ids"), {
      invalidIds: ["unknown-id"],
      allowedIds: ["m1", "m2"]
    });
    mockSynthesizeMoments.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments: [{ id: "m1", score: 10 }] })
      })
    );

    const json = (await response.json()) as { error?: string; details?: { invalidIds?: string[] } };
    expect(response.status).toBe(422);
    expect(json.error).toBe("Synthesis validation failed");
    expect(json.details?.invalidIds).toEqual(["unknown-id"]);
  });

  it("returns 422 when proof-of-use validation fails", async () => {
    const error = Object.assign(new Error("Proof failed"), {
      proofFailure: {
        reasons: ["audienceSignalsUsed must include at least 3 items"],
        audienceSignalsUsedCount: 1,
        searchSignalsUsedCount: 0,
        signalsUsedCount: 0,
        evidenceCount: 0
      }
    });
    mockSynthesizeMoments.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments: [{ id: "m1", score: 10 }] })
      })
    );

    const json = (await response.json()) as {
      error?: string;
      details?: { reasons?: string[] };
    };
    expect(response.status).toBe(422);
    expect(json.error).toBe("Proof-of-use failed");
    expect(json.details?.reasons?.[0]).toContain("audienceSignalsUsed");
  });
});
