import { describe, expect, it } from "vitest";
import { mediaOwnerBriefJsonSchema, playgroundBlueprintJsonSchema } from "@/lib/briefBuilder/types";

describe("brief builder json schema guardrails", () => {
  it("keeps blueprint array caps aligned with zod schema", () => {
    const blueprint = playgroundBlueprintJsonSchema.schema as any;
    expect(blueprint.properties.cultureCodes.items.properties.evidencePointers.maxItems).toBe(6);
    expect(blueprint.properties.communityMap.items.properties.evidencePointers.maxItems).toBe(6);
    expect(blueprint.properties.proofOfUseSummary.properties.usedSources.maxItems).toBe(8);
    expect(blueprint.properties.proofOfUseSummary.properties.evidencePointers.maxItems).toBe(12);
    expect(blueprint.properties.proofOfUseSummary.properties.notes.maxItems).toBe(4);
    expect(blueprint.properties.notes.maxItems).toBe(6);
  });

  it("keeps media brief array caps aligned with zod schema", () => {
    const brief = mediaOwnerBriefJsonSchema.schema as any;
    expect(brief.properties.proofAppendix.properties.evidencePointers.maxItems).toBe(12);
    expect(brief.properties.momentsToBuildAround.items.properties.evidencePointers.maxItems).toBe(6);
    expect(brief.properties.notes.maxItems).toBe(6);
  });
});

