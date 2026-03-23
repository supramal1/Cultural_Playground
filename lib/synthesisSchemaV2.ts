import { z } from "zod";

export const SynthesisV2PlaygroundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  definition: z.string().min(1),
  whyNow: z.string().min(1),
  evidencePointers: z.array(z.string()).default([])
});

export const SynthesisV2OpportunitySchema = z.object({
  momentId: z.string().min(1),
  whyItMatters: z.string().min(1),
  audienceHook: z.string().min(1),
  whatToDo: z.array(z.string()).max(2).default([]),
  channels: z.array(z.string()).max(3).default([]),
  risks: z.array(z.string()).max(2).default([]),
  evidencePointers: z.array(z.string()).default([])
});

export const SynthesisV2ThemeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  whatsHappening: z.string().min(1),
  whyNow: z.string().min(1),
  timing: z.object({
    leadInDays: z.number().int().min(0).max(90),
    peakDays: z.number().int().min(0).max(60),
    coolDownDays: z.number().int().min(0).max(90)
  }),
  activationAngles: z.array(z.string()).max(3).default([]),
  channels: z.array(z.string()).max(4).default([]),
  risks: z.array(z.string()).max(2).default([]),
  momentIds: z.array(z.string()).min(3).max(8),
  evidencePointers: z.array(z.string()).default([])
});

export const SynthesisV2Schema = z.object({
  playground: SynthesisV2PlaygroundSchema,
  executiveAnswer: z.string().min(1),
  opportunities: z.array(SynthesisV2OpportunitySchema).max(8).default([]),
  themes: z.array(SynthesisV2ThemeSchema).max(4).default([]),
  proofOfUse: z.object({
    usedSources: z.array(z.enum(["trends", "reddit", "wikimedia", "audienceCsv", "searchCsv"])).default([]),
    topSignalsUsed: z.array(z.string()).max(10).default([]),
    evidence: z
      .array(
        z.object({
          statement: z.string(),
          pointers: z.array(z.string()).default([])
        })
      )
      .default([])
  }),
  notes: z.array(z.string()).default([])
});

export type SynthesisV2 = z.infer<typeof SynthesisV2Schema>;

export const synthesisV2JsonSchema = {
  name: "cultural_playground_synthesis_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      playground: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          definition: { type: "string" },
          whyNow: { type: "string" },
          evidencePointers: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["id", "name", "definition", "whyNow", "evidencePointers"]
      },
      executiveAnswer: { type: "string" },
      opportunities: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            momentId: { type: "string" },
            whyItMatters: { type: "string" },
            audienceHook: { type: "string" },
            whatToDo: { type: "array", maxItems: 2, items: { type: "string" } },
            channels: { type: "array", maxItems: 3, items: { type: "string" } },
            risks: { type: "array", maxItems: 2, items: { type: "string" } },
            evidencePointers: { type: "array", items: { type: "string" } }
          },
          required: [
            "momentId",
            "whyItMatters",
            "audienceHook",
            "whatToDo",
            "channels",
            "risks",
            "evidencePointers"
          ]
        }
      },
      themes: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            whatsHappening: { type: "string" },
            whyNow: { type: "string" },
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
            activationAngles: { type: "array", maxItems: 3, items: { type: "string" } },
            channels: { type: "array", maxItems: 4, items: { type: "string" } },
            risks: { type: "array", maxItems: 2, items: { type: "string" } },
            momentIds: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
            evidencePointers: { type: "array", items: { type: "string" } }
          },
          required: [
            "id",
            "title",
            "whatsHappening",
            "whyNow",
            "timing",
            "activationAngles",
            "channels",
            "risks",
            "momentIds",
            "evidencePointers"
          ]
        }
      },
      proofOfUse: {
        type: "object",
        additionalProperties: false,
        properties: {
          usedSources: {
            type: "array",
            items: {
              type: "string",
              enum: ["trends", "reddit", "wikimedia", "audienceCsv", "searchCsv"]
            }
          },
          topSignalsUsed: {
            type: "array",
            maxItems: 10,
            items: { type: "string" }
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                statement: { type: "string" },
                pointers: { type: "array", items: { type: "string" } }
              },
              required: ["statement", "pointers"]
            }
          }
        },
        required: ["usedSources", "topSignalsUsed", "evidence"]
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["playground", "executiveAnswer", "opportunities", "themes", "proofOfUse", "notes"]
  }
} as const;

