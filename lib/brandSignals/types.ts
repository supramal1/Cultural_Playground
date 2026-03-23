import { z } from "zod";

export const BrandSignalsQueryDiagnosticSchema = z.object({
  query: z.string().min(1),
  status: z.enum(["OK", "FAILED", "SKIPPED"]),
  postCount: z.number().int().min(0),
  subredditCount: z.number().int().min(0),
  message: z.string().optional()
});

export const BrandSignalsSchema = z.object({
  brandThemes: z.array(z.string()).max(12).default([]),
  brandAdjacencyKeywords: z.array(z.string()).max(20).default([]),
  brandSubreddits: z.array(z.string()).max(5).default([]),
  brandRiskFlags: z.array(z.string()).max(10).default([]),
  queriesUsed: z.array(z.string()).max(3).default([]),
  queryDiagnostics: z.array(BrandSignalsQueryDiagnosticSchema).max(3).default([]),
  evidencePointers: z.array(z.string()).max(40).default([]),
  warnings: z.array(z.string()).default([])
});

export const BrandDiscourseCitationSchema = z.object({
  title: z.string().min(1),
  url: z.string().url()
});

export const BrandDiscourseContextSchema = z.object({
  narratives: z.object({
    positive: z.array(z.string()).max(4).default([]),
    neutral: z.array(z.string()).max(4).default([]),
    negative: z.array(z.string()).max(4).default([])
  }),
  misconceptions: z.array(z.string()).max(5).default([]),
  safetyNotes: z.array(z.string()).max(5).default([]),
  citations: z.array(BrandDiscourseCitationSchema).max(8).default([])
});

export const BrandSignalsBriefSchema = z.object({
  brand: z.string().optional(),
  objective: z.string().optional(),
  audienceKeyword: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  boostKeywords: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional()
});

export const BrandSignalsRequestSchema = z.object({
  brief: BrandSignalsBriefSchema,
  keywordSet: z
    .object({
      core: z.array(z.string()).optional(),
      expansion: z.array(z.string()).optional(),
      negative: z.array(z.string()).optional()
    })
    .optional(),
  options: z
    .object({
      includePerplexity: z.boolean().optional(),
      refresh: z.boolean().optional()
    })
    .optional(),
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional()
});

export type BrandSignals = z.infer<typeof BrandSignalsSchema>;
export type BrandDiscourseContext = z.infer<typeof BrandDiscourseContextSchema>;
export type BrandSignalsRequest = z.infer<typeof BrandSignalsRequestSchema>;

export const brandDiscourseJsonSchema = {
  name: "brand_discourse_context",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      narratives: {
        type: "object",
        additionalProperties: false,
        properties: {
          positive: { type: "array", maxItems: 4, items: { type: "string" } },
          neutral: { type: "array", maxItems: 4, items: { type: "string" } },
          negative: { type: "array", maxItems: 4, items: { type: "string" } }
        },
        required: ["positive", "neutral", "negative"]
      },
      misconceptions: { type: "array", maxItems: 5, items: { type: "string" } },
      safetyNotes: { type: "array", maxItems: 5, items: { type: "string" } },
      citations: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            url: { type: "string" }
          },
          required: ["title", "url"]
        }
      }
    },
    required: ["narratives", "misconceptions", "safetyNotes", "citations"]
  }
} as const;
