import { z } from "zod";

export const AudienceCompositionRowSchema = z.object({
  label: z.string().min(1),
  share: z.number().nullable().optional(),
  baselineShare: z.number().nullable().optional(),
  index: z.number().nullable().optional(),
  relevance: z.number().nullable().optional()
});

export const AudienceAffinityRowSchema = z.object({
  area: z.string().min(1),
  subArea: z.string().min(1),
  item: z.string().min(1),
  index: z.number().nullable().optional(),
  share: z.number().nullable().optional(),
  relevance: z.number().nullable().optional(),
  url: z.string().optional()
});

export const AudienceInsightsNormalizedSchema = z.object({
  meta: z.object({
    downloadDate: z.string().optional(),
    location: z.string().optional(),
    timeFrame: z.string().optional(),
    topic: z.string().optional(),
    audience: z.string().optional(),
    baselineAudience: z.string().optional()
  }),
  composition: z.object({
    gender: z.array(AudienceCompositionRowSchema).optional(),
    age: z.array(AudienceCompositionRowSchema).optional()
  }),
  topAffinities: z.array(AudienceAffinityRowSchema),
  derived: z.object({
    seedKeywords: z.array(z.string()).max(25),
    exclusions: z.array(z.string()).default([])
  })
});

export type AudienceInsightsNormalized = z.infer<typeof AudienceInsightsNormalizedSchema>;

export const SearchQueryRowSchema = z.object({
  query: z.string().min(1),
  trend: z.string().min(1),
  indexedSearches: z.number().nullable().optional(),
  monthlySearchVolume: z.number().nullable().optional()
});

export const SearchInsightsNormalizedSchema = z.object({
  meta: z.object({
    downloadDate: z.string().optional(),
    location: z.string().optional(),
    timeFrame: z.string().optional(),
    topic: z.string().optional()
  }),
  timeSeries: z.array(
    z.object({
      monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      indexedSearches: z.number().nullable().optional(),
      momGrowth: z.number().nullable().optional(),
      yoyGrowth: z.number().nullable().optional()
    })
  ),
  queriesLatestMonth: z.object({
    monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    byTrend: z.object({
      top: z.array(SearchQueryRowSchema),
      fastRising: z.array(SearchQueryRowSchema),
      sustainedGrowth: z.array(SearchQueryRowSchema),
      emerging: z.array(SearchQueryRowSchema),
      declining: z.array(SearchQueryRowSchema)
    })
  }),
  derived: z.object({
    seedKeywords: z.array(z.string()).max(25),
    negativeKeywords: z.array(z.string()).default([])
  })
});

export type SearchInsightsNormalized = z.infer<typeof SearchInsightsNormalizedSchema>;

export const InsightsPayloadSchema = z.object({
  audience: AudienceInsightsNormalizedSchema.optional(),
  search: SearchInsightsNormalizedSchema.optional()
});

export type InsightsPayload = z.infer<typeof InsightsPayloadSchema>;
