import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { mockGenerateSlide } = vi.hoisted(() => ({
  mockGenerateSlide: vi.fn()
}));

vi.mock("@/lib/slideService", () => ({
  generateSlide: mockGenerateSlide,
  SlideRequestSchema: z.object({
    moments: z.array(z.object({ id: z.string(), score: z.number() })).min(1),
    synthesis: z.unknown().optional(),
    audience: z.string().optional(),
    brandConstraints: z.string().optional(),
    includeAll: z.boolean().optional().default(false)
  })
}));

import { POST } from "@/app/api/slide/route";

describe("POST /api/slide", () => {
  beforeEach(() => {
    mockGenerateSlide.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("returns 422 when slide references unknown ids after verification", async () => {
    const error = Object.assign(new Error("Invalid ids"), {
      invalidIds: ["unknown-id"],
      allowedIds: ["m1", "m2"]
    });
    mockGenerateSlide.mockRejectedValue(error);

    const response = await POST(
      new Request("http://localhost/api/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moments: [{ id: "m1", score: 10 }] })
      })
    );

    const json = (await response.json()) as { error?: string; details?: { invalidIds?: string[] } };
    expect(response.status).toBe(422);
    expect(json.error).toBe("Slide validation failed");
    expect(json.details?.invalidIds).toEqual(["unknown-id"]);
  });
});
