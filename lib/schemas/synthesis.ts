import { z } from "zod";

export const SynthesisThemeTimingSchema = z.object({
  leadInDays: z.number().int().min(0).max(90),
  peakDays: z.number().int().min(0).max(60),
  coolDownDays: z.number().int().min(0).max(90)
});

export const SynthesisThemeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  whyThisMatters: z.string().min(1),
  timing: SynthesisThemeTimingSchema,
  activationAngles: z.array(z.string()).min(1).max(3),
  channels: z.array(z.string()).min(1).max(4),
  risks: z.array(z.string()).max(2).default([]),
  momentIds: z.array(z.string()).min(3).max(8)
});

export const SynthesisEvidenceSchema = z.object({
  statement: z.string().min(1),
  source: z.enum(["AudienceInsights", "SearchInsights", "Signals", "Moments"]),
  pointers: z.array(z.string().min(1)).min(1).max(6)
});

export const SynthesisSchema = z.object({
  execSummary: z.string().min(1),
  planningImplications: z.array(z.string()).min(3).max(6),
  themes: z.array(SynthesisThemeSchema).min(3).max(5),
  topMomentIds: z.array(z.string()).max(10),
  audienceSignalsUsed: z.array(z.string()).default([]),
  searchSignalsUsed: z.array(z.string()).default([]),
  signalsUsed: z.array(z.string()).default([]),
  evidence: z.array(SynthesisEvidenceSchema).max(6).default([]),
  notes: z.array(z.string()).default([])
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

export const synthesisJsonSchema = {
  name: "cultural_moments_synthesis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      execSummary: {
        type: "string",
        description:
          "2-4 generic sentences only; do not include factual specifics such as dates, venues, opponents, or event titles."
      },
      planningImplications: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "string"
        }
      },
      themes: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            whyThisMatters: { type: "string" },
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
            activationAngles: {
              type: "array",
              maxItems: 3,
              items: { type: "string" }
            },
            channels: {
              type: "array",
              maxItems: 4,
              items: { type: "string" }
            },
            risks: {
              type: "array",
              maxItems: 2,
              items: { type: "string" }
            },
            momentIds: {
              type: "array",
              minItems: 3,
              maxItems: 8,
              items: { type: "string" }
            }
          },
          required: [
            "id",
            "title",
            "whyThisMatters",
            "timing",
            "activationAngles",
            "channels",
            "risks",
            "momentIds"
          ]
        }
      },
      topMomentIds: {
        type: "array",
        maxItems: 10,
        items: { type: "string" }
      },
      audienceSignalsUsed: {
        type: "array",
        items: { type: "string" }
      },
      searchSignalsUsed: {
        type: "array",
        items: { type: "string" }
      },
      signalsUsed: {
        type: "array",
        items: { type: "string" }
      },
      evidence: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            statement: { type: "string" },
            source: {
              type: "string",
              enum: ["AudienceInsights", "SearchInsights", "Signals", "Moments"]
            },
            pointers: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: { type: "string" }
            }
          },
          required: ["statement", "source", "pointers"]
        }
      },
      notes: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: [
      "execSummary",
      "planningImplications",
      "themes",
      "topMomentIds",
      "audienceSignalsUsed",
      "searchSignalsUsed",
      "signalsUsed",
      "evidence",
      "notes"
    ]
  }
} as const;
