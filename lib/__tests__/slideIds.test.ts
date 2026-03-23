import { describe, expect, it } from "vitest";
import { invalidSlideReferencedIds, normalizeSlideReferencedIds } from "@/lib/slideService";
import type { Slide } from "@/lib/schemas/slide";

const slide: Slide = {
  slideTitle: "Plan",
  keyTakeaways: ["A", "B", "C"],
  momentCallouts: [
    { momentId: "m1", label: "One", whyRelevant: "Relevant" },
    { momentId: "bad-id", label: "Bad", whyRelevant: "Unknown" },
    { momentId: "bad-id", label: "Bad duplicate", whyRelevant: "Unknown" }
  ],
  activationAngles: ["Angle 1", "Angle 2", "Angle 3"],
  recommendedChannels: ["social"],
  risksAndGuardrails: ["risk"],
  speakerNotes: "notes",
  confidenceNote: "note"
};

describe("invalidSlideReferencedIds", () => {
  it("returns unique invalid momentIds", () => {
    const allowed = new Set(["m1", "m2"]);
    const invalid = invalidSlideReferencedIds(slide, allowed);

    expect(invalid).toEqual(["bad-id"]);
  });

  it("normalizes unique one-character id typos", () => {
    const typoSlide: Slide = {
      ...slide,
      momentCallouts: [{ momentId: "804d761220d08ab1f6fc", label: "One", whyRelevant: "Relevant" }]
    };
    const allowed = new Set(["704d761220d08ab1f6fc"]);
    const normalized = normalizeSlideReferencedIds(typoSlide, allowed);
    const invalid = invalidSlideReferencedIds(normalized, allowed);

    expect(normalized.momentCallouts[0].momentId).toBe("704d761220d08ab1f6fc");
    expect(invalid).toEqual([]);
  });
});
