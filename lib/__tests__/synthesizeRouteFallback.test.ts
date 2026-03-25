import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { mockBlueprint, mockBrief } = vi.hoisted(() => ({
  mockBlueprint: vi.fn(),
  mockBrief: vi.fn()
}));

vi.mock("@/lib/synthesisService", () => ({
  synthesizeMoments: vi.fn(),
  SynthesizeRequestSchema: z.any()
}));

vi.mock("@/lib/synthesisServiceV2", () => ({
  synthesizePlanDataV2: vi.fn(),
  SynthesizeV2RequestSchema: z.any()
}));

vi.mock("@/lib/briefBuilder/service", () => ({
  synthesizeBlueprint: mockBlueprint,
  synthesizeMediaOwnerBrief: mockBrief
}));

vi.mock("@/lib/briefBuilder/types", () => ({
  SynthesizeBlueprintRequestSchema: z
    .object({
      version: z.literal("v2").optional(),
      mode: z.literal("blueprint")
    })
    .passthrough(),
  SynthesizeBriefRequestSchema: z
    .object({
      version: z.literal("v2").optional(),
      mode: z.literal("brief")
    })
    .passthrough()
}));

import { POST } from "@/app/api/synthesize/route";

describe("POST /api/synthesize fallback routing", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    mockBlueprint.mockReset();
    mockBrief.mockReset();
  });

  it("allows v2 blueprint synthesis without OPENAI_API_KEY", async () => {
    mockBlueprint.mockResolvedValue({
      blueprint: { playgroundId: "demo", playgroundName: "Demo" },
      warnings: ["fallback"]
    });

    const response = await POST(
      new Request("http://localhost/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v2",
          mode: "blueprint",
          brief: {
            audienceKeyword: "Gen Z students",
            from: "2026-03-01",
            to: "2026-04-30"
          },
          chosenPlayground: {
            id: "travel",
            name: "Travel"
          }
        })
      })
    );

    const json = (await response.json()) as {
      blueprint?: { playgroundId?: string };
      meta?: { warnings?: string[] };
    };

    expect(response.status).toBe(200);
    expect(json.blueprint?.playgroundId).toBe("demo");
    expect(json.meta?.warnings).toEqual(["fallback"]);
    expect(mockBlueprint).toHaveBeenCalledTimes(1);
  });
});
