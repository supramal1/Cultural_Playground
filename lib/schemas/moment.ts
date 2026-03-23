import { z } from "zod";
import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { hashId } from "@/lib/hash";

export const MomentCategorySchema = z.enum(["holidays", "film", "sports", "events"]);

export const MomentSchema = z.object({
  id: z.string().min(3),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime().optional(),
  timezone: z.string().default(DEFAULT_TIMEZONE),
  region: z.string().default(REGION),
  locationName: z.string().optional(),
  category: MomentCategorySchema,
  subcategory: z.string().optional(),
  description: z.string().default(""),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  confidence: z.enum(["high", "medium", "low"]),
  tags: z.array(z.string()).default([]),
  brandSafetyFlags: z.array(z.string()).default([])
});

export const ScoreBreakdownSchema = z.object({
  proximityBoost: z.number(),
  majorBoost: z.number(),
  keywordBoost: z.number(),
  confidenceBoost: z.number().default(0),
  qualityTierBoost: z.number().optional()
});

export const ScoredMomentSchema = MomentSchema.extend({
  score: z.number(),
  qualityTier: z.enum(["flagship", "notable", "filler"]).optional(),
  scoreBreakdown: ScoreBreakdownSchema.optional()
});

export type Moment = z.infer<typeof MomentSchema>;
export type ScoredMoment = z.infer<typeof ScoredMomentSchema>;

export function buildMomentId(input: {
  sourceName: string;
  sourceId: string;
  startDateTime: string;
  title: string;
}): string {
  const base = `${input.sourceName}|${input.sourceId}`;
  return hashId(base);
}
