import { describe, expect, it } from "vitest";
import { invalidReferencedIds, normalizeSynthesisReferencedIds } from "@/lib/synthesisService";
import type { Synthesis } from "@/lib/schemas/synthesis";

const synthesis: Synthesis = {
  execSummary: "High-level generic summary.",
  planningImplications: ["A", "B", "C"],
  themes: [
    {
      id: "sports-theme",
      title: "Sports theme",
      whyThisMatters: "Generic rationale",
      timing: {
        leadInDays: 7,
        peakDays: 2,
        coolDownDays: 3
      },
      momentIds: ["m1", "m2", "bad-id"],
      activationAngles: ["Idea A"],
      channels: ["social"],
      risks: ["Risk A"]
    }
  ],
  topMomentIds: ["m1", "bad-top"],
  audienceSignalsUsed: [],
  searchSignalsUsed: [],
  signalsUsed: [],
  evidence: [],
  notes: ["Coverage limited"]
};

describe("invalidReferencedIds", () => {
  it("returns only ids not present in allowed set", () => {
    const allowed = new Set(["m1", "m2"]);
    const invalid = invalidReferencedIds(synthesis, allowed);

    expect(invalid).toContain("bad-id");
    expect(invalid).toContain("bad-top");
    expect(invalid).not.toContain("m1");
  });

  it("normalizes single-character id typos when match is unique", () => {
    const typoSynthesis: Synthesis = {
      ...synthesis,
      themes: [
        {
          ...synthesis.themes[0],
          momentIds: ["704d761220d08ab1f6fc", "m2", "m1"]
        }
      ],
      topMomentIds: ["804d761220d08ab1f6fc", "m1"]
    };

    const allowed = new Set(["704d761220d08ab1f6fc", "m1", "m2"]);
    const normalized = normalizeSynthesisReferencedIds(typoSynthesis, allowed);
    const invalid = invalidReferencedIds(normalized, allowed);

    expect(normalized.topMomentIds[0]).toBe("704d761220d08ab1f6fc");
    expect(invalid).toEqual([]);
  });
});
