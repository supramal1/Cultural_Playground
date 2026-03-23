import { z } from "zod";

export const SlideMomentCalloutSchema = z.object({
  momentId: z.string().min(1),
  label: z.string().min(1),
  whyRelevant: z.string().min(1)
});

export const SlideSchema = z.object({
  slideTitle: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  keyTakeaways: z.array(z.string()).min(3).max(5),
  momentCallouts: z.array(SlideMomentCalloutSchema),
  activationAngles: z.array(z.string()).min(3).max(5),
  recommendedChannels: z.array(z.string()).default([]),
  risksAndGuardrails: z.array(z.string()).default([]),
  speakerNotes: z.string().min(1),
  confidenceNote: z.string().min(1)
});

export type Slide = z.infer<typeof SlideSchema>;

export const slideJsonSchema = {
  name: "cultural_moments_slide",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      slideTitle: { type: "string" },
      subtitle: { type: ["string", "null"] },
      keyTakeaways: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" }
      },
      momentCallouts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            momentId: { type: "string" },
            label: { type: "string" },
            whyRelevant: { type: "string" }
          },
          required: ["momentId", "label", "whyRelevant"]
        }
      },
      activationAngles: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" }
      },
      recommendedChannels: {
        type: "array",
        items: { type: "string" }
      },
      risksAndGuardrails: {
        type: "array",
        items: { type: "string" }
      },
      speakerNotes: { type: "string" },
      confidenceNote: { type: "string" }
    },
    required: [
      "slideTitle",
      "subtitle",
      "keyTakeaways",
      "momentCallouts",
      "activationAngles",
      "recommendedChannels",
      "risksAndGuardrails",
      "speakerNotes",
      "confidenceNote"
    ]
  }
} as const;
