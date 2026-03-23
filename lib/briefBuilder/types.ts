import { z } from "zod";
import { PlaygroundBriefSchema, PlaygroundCandidateSchema, PlanMomentSchema } from "@/lib/playground/types";
import { InsightsPayloadSchema } from "@/lib/insights/types";
import { SignalsBundleSchema } from "@/lib/signals/types";
import { BrandDiscourseContextSchema, BrandSignalsSchema } from "@/lib/brandSignals/types";
import { PlaygroundContextResponseSchema, OpportunityContextResponseSchema } from "@/lib/playground/perplexityContext";

export const PlaygroundBlueprintCodeSchema = z.object({
  phrase: z.string().min(1),
  meaning: z.string().min(1),
  evidencePointers: z.array(z.string()).max(6).default([])
});

export const PlaygroundBlueprintCommunitySchema = z.object({
  community: z.string().min(1),
  careAbout: z.string().min(1),
  evidencePointers: z.array(z.string()).max(6).default([])
});

export const PlaygroundBlueprintSchema = z.object({
  playgroundId: z.string().min(1),
  playgroundName: z.string().min(1),
  coreIdea: z.string().min(1),
  whoItsFor: z.array(z.string()).min(2).max(4),
  cultureCodes: z.array(PlaygroundBlueprintCodeSchema).min(5).max(10),
  communityMap: z.array(PlaygroundBlueprintCommunitySchema).min(3).max(6),
  tensionsTruths: z.array(z.string()).min(3).max(5),
  brandRole: z.array(z.string()).min(2).max(3),
  guardrails: z.array(z.string()).min(4).max(8),
  measurementSuggestions: z.array(z.string()).min(3).max(5),
  proofOfUseSummary: z.object({
    usedSources: z.array(z.string()).max(8).default([]),
    evidencePointers: z.array(z.string()).max(12).default([]),
    notes: z.array(z.string()).max(4).default([])
  }),
  notes: z.array(z.string()).max(6).default([])
});

export const MediaOwnerBriefMomentSchema = z.object({
  momentId: z.string().min(1),
  culturalBehaviour: z.string().default(""),
  audienceState: z.string().default(""),
  actionBullets: z.array(z.string()).max(2).default([]),
  evidencePointers: z.array(z.string()).max(6).default([])
});

export const MediaOwnerBriefSchema = z.object({
  cultureSnapshot: z.string().default(""),
  culturalTension: z.string().default(""),
  timingWindow: z.string().default(""),
  briefOneLiner: z.string().min(1),
  objectiveKpi: z.string().min(1),
  audienceMindset: z.string().min(1),
  playgroundDefinitionCodes: z.string().min(1),
  theAsk: z.string().min(1),
  deliverables: z.array(z.string()).min(3).max(6),
  timing: z.object({
    leadInDays: z.number().int().min(0).max(90),
    peakDays: z.number().int().min(0).max(60),
    coolDownDays: z.number().int().min(0).max(90)
  }),
  guardrails: z.array(z.string()).min(4).max(8),
  proofAppendix: z.object({
    citations: z.array(z.string()).min(3).max(5),
    signalBullets: z.array(z.string()).min(3).max(5),
    evidencePointers: z.array(z.string()).max(12).default([])
  }),
  momentsToBuildAround: z.array(MediaOwnerBriefMomentSchema).max(8).default([]),
  notes: z.array(z.string()).max(6).default([])
});

export const SynthesizeBlueprintRequestSchema = z.object({
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional(),
  mode: z.literal("blueprint"),
  brief: PlaygroundBriefSchema,
  chosenPlayground: PlaygroundCandidateSchema,
  brandSignals: BrandSignalsSchema.optional(),
  brandDiscourseContext: BrandDiscourseContextSchema.optional(),
  insights: InsightsPayloadSchema.optional(),
  signals: SignalsBundleSchema.optional(),
  playgroundContext: PlaygroundContextResponseSchema.optional()
});

export const SynthesizeBriefRequestSchema = z.object({
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional(),
  mode: z.literal("brief"),
  brief: PlaygroundBriefSchema,
  blueprint: PlaygroundBlueprintSchema,
  selectedOpportunities: z.array(PlanMomentSchema).max(8).optional(),
  opportunityContext: OpportunityContextResponseSchema.optional(),
  signalScaleContext: z.array(z.string()).optional(),
  instruction: z.string().optional()
});

export type PlaygroundBlueprint = z.infer<typeof PlaygroundBlueprintSchema>;
export type MediaOwnerBrief = z.infer<typeof MediaOwnerBriefSchema>;
export type SynthesizeBlueprintRequest = z.infer<typeof SynthesizeBlueprintRequestSchema>;
export type SynthesizeBriefRequest = z.infer<typeof SynthesizeBriefRequestSchema>;

export const playgroundBlueprintJsonSchema = {
  name: "playground_blueprint_v3",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      playgroundId: { type: "string" },
      playgroundName: { type: "string" },
      coreIdea: { type: "string" },
      whoItsFor: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
      cultureCodes: {
        type: "array",
        minItems: 5,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            phrase: { type: "string" },
            meaning: { type: "string" },
            evidencePointers: { type: "array", maxItems: 6, items: { type: "string" } }
          },
          required: ["phrase", "meaning", "evidencePointers"]
        }
      },
      communityMap: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            community: { type: "string" },
            careAbout: { type: "string" },
            evidencePointers: { type: "array", maxItems: 6, items: { type: "string" } }
          },
          required: ["community", "careAbout", "evidencePointers"]
        }
      },
      tensionsTruths: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
      brandRole: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
      guardrails: { type: "array", minItems: 4, maxItems: 8, items: { type: "string" } },
      measurementSuggestions: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
      proofOfUseSummary: {
        type: "object",
        additionalProperties: false,
        properties: {
          usedSources: { type: "array", maxItems: 8, items: { type: "string" } },
          evidencePointers: { type: "array", maxItems: 12, items: { type: "string" } },
          notes: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["usedSources", "evidencePointers", "notes"]
      },
      notes: { type: "array", maxItems: 6, items: { type: "string" } }
    },
    required: [
      "playgroundId",
      "playgroundName",
      "coreIdea",
      "whoItsFor",
      "cultureCodes",
      "communityMap",
      "tensionsTruths",
      "brandRole",
      "guardrails",
      "measurementSuggestions",
      "proofOfUseSummary",
      "notes"
    ]
  }
} as const;

export const mediaOwnerBriefJsonSchema = {
  name: "media_owner_brief_v3",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      cultureSnapshot: { type: "string" },
      culturalTension: { type: "string" },
      timingWindow: { type: "string" },
      briefOneLiner: { type: "string" },
      objectiveKpi: { type: "string" },
      audienceMindset: { type: "string" },
      playgroundDefinitionCodes: { type: "string" },
      theAsk: { type: "string" },
      deliverables: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
      timing: {
        type: "object",
        additionalProperties: false,
        properties: {
          leadInDays: { type: "integer", minimum: 0, maximum: 90 },
          peakDays: { type: "integer", minimum: 0, maximum: 60 },
          coolDownDays: { type: "integer", minimum: 0, maximum: 90 }
        },
        required: ["leadInDays", "peakDays", "coolDownDays"]
      },
      guardrails: { type: "array", minItems: 4, maxItems: 8, items: { type: "string" } },
      proofAppendix: {
        type: "object",
        additionalProperties: false,
        properties: {
          citations: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          signalBullets: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          evidencePointers: { type: "array", maxItems: 12, items: { type: "string" } }
        },
        required: ["citations", "signalBullets", "evidencePointers"]
      },
      momentsToBuildAround: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            momentId: { type: "string" },
            culturalBehaviour: { type: "string" },
            audienceState: { type: "string" },
            actionBullets: { type: "array", maxItems: 2, items: { type: "string" } },
            evidencePointers: { type: "array", maxItems: 6, items: { type: "string" } }
          },
          required: ["momentId", "culturalBehaviour", "audienceState", "actionBullets", "evidencePointers"]
        }
      },
      notes: { type: "array", maxItems: 6, items: { type: "string" } }
    },
    required: [
      "cultureSnapshot",
      "culturalTension",
      "timingWindow",
      "briefOneLiner",
      "objectiveKpi",
      "audienceMindset",
      "playgroundDefinitionCodes",
      "theAsk",
      "deliverables",
      "timing",
      "guardrails",
      "proofAppendix",
      "momentsToBuildAround",
      "notes"
    ]
  }
} as const;
