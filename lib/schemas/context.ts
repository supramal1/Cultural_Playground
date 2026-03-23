import { z } from "zod";

export const ExternalContextSignalSchema = z.object({
  title: z.string().min(1),
  insight: z.string().min(1),
  implication: z.string().min(1)
});

export const ExternalContextSchema = z.object({
  summary: z.string().min(1),
  signals: z.array(ExternalContextSignalSchema).min(3).max(5),
  watchouts: z.array(z.string()).max(4).default([]),
  notes: z.array(z.string()).max(3).default([])
});

export type ExternalContext = z.infer<typeof ExternalContextSchema>;

export const externalContextJsonSchema = {
  name: "cultural_moments_external_context",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: {
        type: "string",
        description:
          "Two to four concise sentences that explain the broader cultural context for planners."
      },
      signals: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            insight: { type: "string" },
            implication: { type: "string" }
          },
          required: ["title", "insight", "implication"]
        }
      },
      watchouts: {
        type: "array",
        maxItems: 4,
        items: { type: "string" }
      },
      notes: {
        type: "array",
        maxItems: 3,
        items: { type: "string" }
      }
    },
    required: ["summary", "signals", "watchouts", "notes"]
  }
} as const;
