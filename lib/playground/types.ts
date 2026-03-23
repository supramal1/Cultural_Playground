import { z } from "zod";
import { InsightsPayloadSchema } from "@/lib/insights/types";
import { SignalsBundleSchema } from "@/lib/signals/types";
import { ScoredMomentSchema } from "@/lib/schemas/moment";

export const PlaygroundCategorySchema = z.enum(["sports", "film", "holidays", "events"]);
export type MomentCategory = z.infer<typeof PlaygroundCategorySchema>;

export const PlaygroundKeywordsSchema = z.object({
  core: z.array(z.string()).max(12),
  expansion: z.array(z.string()).max(18),
  negative: z.array(z.string()).max(10)
});

export const PlaygroundCommunitiesSchema = z.object({
  subreddits: z.array(z.string()).default([])
});

export const PlaygroundSeasonSchema = z.enum(["winter", "spring", "summer", "autumn"]);
export type PlaygroundSeason = z.infer<typeof PlaygroundSeasonSchema>;

export const PlaygroundBaselineLabelSchema = z.enum([
  "below-normal",
  "normal",
  "above-normal",
  "high"
]);

export const PlaygroundCategoryBaselineSchema = z.object({
  primaryCategory: PlaygroundCategorySchema,
  season: PlaygroundSeasonSchema,
  demandNormal: z.number().min(0).max(100),
  demandHigh: z.number().min(0).max(100),
  conversationNormal: z.number().min(0).max(100),
  conversationHigh: z.number().min(0).max(100),
  demandDelta: z.number(),
  conversationDelta: z.number(),
  demandLabel: PlaygroundBaselineLabelSchema,
  conversationLabel: PlaygroundBaselineLabelSchema
});

export const PlaygroundEvidenceQaSchema = z.object({
  confidenceBand: z.enum(["high", "medium", "low"]),
  sampleSize: z.object({
    trendsRisingQueries: z.number().int().min(0),
    trendsRisingTopics: z.number().int().min(0),
    redditPosts: z.number().int().min(0),
    redditThemes: z.number().int().min(0),
    redditSubreddits: z.number().int().min(0),
    evidencePointers: z.number().int().min(0),
    totalSignals: z.number().int().min(0)
  }),
  freshness: z.object({
    generatedAt: z.string().datetime(),
    newestSignalAt: z.string().datetime().nullable(),
    oldestSignalAt: z.string().datetime().nullable(),
    ageHours: z.number().min(0)
  }),
  rationale: z.array(z.string()).max(4).default([])
});

export const AudienceAlignmentSchema = z.object({
  type: z.enum(["core", "adjacent", "unknown"]),
  note: z.string()
});

export const PlaygroundCandidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  definition: z.string().min(1),
  whyNow: z.string().min(1),
  fitScore: z.number().min(0).max(100),
  demandScore: z.number().min(0).max(100),
  conversationScore: z.number().min(0).max(100),
  riskFlags: z.array(z.string()).default([]),
  evidencePointers: z.array(z.string()).default([]),
  keywords: PlaygroundKeywordsSchema,
  communities: PlaygroundCommunitiesSchema,
  recommendedCategories: z.array(PlaygroundCategorySchema).min(1),
  categoryBaseline: PlaygroundCategoryBaselineSchema.optional(),
  evidenceQa: PlaygroundEvidenceQaSchema.optional(),
  audienceAlignment: AudienceAlignmentSchema.optional(),
  notes: z.array(z.string()).default([])
});

export const ChosenPlaygroundSchema = z.object({
  candidate: PlaygroundCandidateSchema,
  userEditedKeywords: z
    .object({
      core: z.array(z.string()).optional(),
      expansion: z.array(z.string()).optional(),
      negative: z.array(z.string()).optional()
    })
    .optional()
});

export const MomentSignalMatchSchema = z.object({
  momentId: z.string().min(1),
  matched: z.object({
    trends: z
      .array(
        z.object({
          label: z.string(),
          pointer: z.string()
        })
      )
      .default([]),
    reddit: z
      .array(
        z.object({
          label: z.string(),
          pointer: z.string(),
          url: z.string().url().optional()
        })
      )
      .default([]),
    wiki: z
      .array(
        z.object({
          entity: z.string(),
          pointer: z.string()
        })
      )
      .default([])
  }),
  signalBoost: z.object({
    trends: z.number().min(0).max(8),
    reddit: z.number().min(0).max(6),
    wiki: z.number().min(0).max(10),
    total: z.number().min(0).max(20)
  }),
  evidencePointers: z.array(z.string()).default([]),
  debug: z
    .object({
      matchedKeywords: z.array(z.string()).default([])
    })
    .optional()
});

export const PlanMomentSchema = ScoredMomentSchema.extend({
  baseScore: z.number(),
  finalScore: z.number(),
  signalBoost: z.object({
    trends: z.number().min(0).max(8),
    reddit: z.number().min(0).max(6),
    wiki: z.number().min(0).max(10),
    total: z.number().min(0).max(20)
  }),
  evidencePointers: z.array(z.string()).default([]),
  signalMatch: MomentSignalMatchSchema.optional()
});

export const PlanDataMetaSchema = z.object({
  keywordSetInPlay: z.array(z.string()),
  providerStatus: z.record(z.string(), z.any()).default({}),
  wikiMatchesCount: z.number().int().min(0),
  coverageNotes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  queryStrategy: z.record(z.string(), z.any()).optional(),
  insightsSummary: z.record(z.string(), z.any()).optional(),
  signalsSummary: z.record(z.string(), z.any()).optional(),
  version: z.enum(["v1", "v2"]).default("v2")
});

export const PlanDataSchema = z.object({
  playground: ChosenPlaygroundSchema,
  moments: z.array(PlanMomentSchema),
  signals: SignalsBundleSchema,
  insights: InsightsPayloadSchema.optional(),
  meta: PlanDataMetaSchema
});

export const PlaygroundBriefSchema = z.object({
  brand: z.string().optional(),
  objective: z.string().optional(),
  audienceKeyword: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categories: z.array(PlaygroundCategorySchema).optional(),
  boostKeywords: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional()
});

export const PlaygroundDiscoveryRequestSchema = z.object({
  brief: PlaygroundBriefSchema,
  insights: InsightsPayloadSchema.optional(),
  options: z
    .object({
      maxCandidates: z.number().int().min(3).max(8).optional(),
      skipDiscoverySignals: z.boolean().optional(),
      includePerplexity: z.boolean().optional(),
      refresh: z.boolean().optional()
    })
    .optional(),
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional()
});

export const PlanDataRequestSchema = z.object({
  brief: PlaygroundBriefSchema.extend({
    categories: z.array(PlaygroundCategorySchema).optional()
  }),
  chosenPlayground: z.object({
    playgroundId: z.string().min(1),
    userEditedKeywords: z
      .object({
        core: z.array(z.string()).optional(),
        expansion: z.array(z.string()).optional(),
        negative: z.array(z.string()).optional()
      })
      .optional()
  }),
  insights: InsightsPayloadSchema.optional(),
  options: z
    .object({
      includeContext: z.boolean().optional(),
      refresh: z.boolean().optional()
    })
    .optional(),
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional()
});

export type AudienceAlignment = z.infer<typeof AudienceAlignmentSchema>;
export type PlaygroundCandidate = z.infer<typeof PlaygroundCandidateSchema>;
export type ChosenPlayground = z.infer<typeof ChosenPlaygroundSchema>;
export type MomentSignalMatch = z.infer<typeof MomentSignalMatchSchema>;
export type PlanMoment = z.infer<typeof PlanMomentSchema>;
export type PlanData = z.infer<typeof PlanDataSchema>;
export type PlaygroundBrief = z.infer<typeof PlaygroundBriefSchema>;
export type PlaygroundDiscoveryRequest = z.infer<typeof PlaygroundDiscoveryRequestSchema>;
export type PlanDataRequest = z.infer<typeof PlanDataRequestSchema>;
export type PlaygroundCategoryBaseline = z.infer<typeof PlaygroundCategoryBaselineSchema>;
export type PlaygroundEvidenceQa = z.infer<typeof PlaygroundEvidenceQaSchema>;
