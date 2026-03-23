import { z } from "zod";

export const SignalSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional()
});

export const SignalProviderStatusSchema = z.enum(["OK", "FAILED", "SKIPPED"]);

export const SignalProviderDiagnosticsSchema = z.object({
  status: SignalProviderStatusSchema,
  ms: z.number().int().min(0),
  cache: z.enum(["hit", "miss", "n/a"]).default("n/a"),
  items: z.number().int().min(0).default(0),
  errorType: z.string().optional(),
  message: z.string().optional()
});

export const GoogleTrendsQuerySchema = z.object({
  query: z.string().min(1),
  type: z.enum(["rising", "top"]),
  value: z.number().nullable().optional()
});

export const GoogleTrendsTopicSchema = z.object({
  topic: z.string().min(1),
  type: z.enum(["rising", "top"]),
  value: z.number().nullable().optional()
});

export const GoogleTrendsInterestPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().int().min(0).max(100)
});

export const GoogleTrendsSignalsSchema = z.object({
  topRelatedQueries: z.array(GoogleTrendsQuerySchema).default([]),
  topRelatedTopics: z.array(GoogleTrendsTopicSchema).default([]),
  interestOverTime: z.array(GoogleTrendsInterestPointSchema).default([]),
  sources: z.array(SignalSourceSchema).default([])
});

export const RedditSubredditCandidateSchema = z.object({
  name: z.string().min(1),
  reason: z.string().min(1)
});

export const RedditTopPostSchema = z.object({
  title: z.string().min(1),
  subreddit: z.string().min(1),
  url: z.string().url(),
  score: z.number().nullable().optional(),
  comments: z.number().nullable().optional(),
  createdUtc: z.number().nullable().optional()
});

export const RedditSignalsSchema = z.object({
  subredditCandidates: z.array(RedditSubredditCandidateSchema).default([]),
  topPosts: z.array(RedditTopPostSchema).default([]),
  commonThemes: z.array(z.string()).default([]),
  sources: z.array(SignalSourceSchema).default([])
});

export const WikimediaViewsPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  views: z.number().int().nonnegative()
});

export const WikimediaEntitySchema = z.object({
  title: z.string().min(1),
  project: z.string().min(1),
  views: z.array(WikimediaViewsPointSchema).default([]),
  total: z.number().int().nonnegative()
});

export const WikimediaSignalsSchema = z.object({
  entities: z.array(WikimediaEntitySchema).default([]),
  sources: z.array(SignalSourceSchema).default([])
});

export const GuardianArticleSchema = z.object({
  title: z.string().min(1),
  section: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().min(1),
  trailText: z.string().optional()
});

export const GuardianSignalsSchema = z.object({
  articles: z.array(GuardianArticleSchema).default([]),
  topSections: z.array(z.string()).default([]),
  sources: z.array(SignalSourceSchema).default([])
});

export const SignalsBundleSchema = z.object({
  meta: z.object({
    generatedAt: z.string().datetime(),
    inputs: z.object({
      keywords: z.array(z.string()),
      audience: z.string().optional(),
      dateRange: z
        .object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        })
        .optional()
    }),
    providers: z.object({
      googleTrends: SignalProviderDiagnosticsSchema,
      reddit: SignalProviderDiagnosticsSchema,
      wikimedia: SignalProviderDiagnosticsSchema,
      guardian: SignalProviderDiagnosticsSchema
    })
  }),
  googleTrends: GoogleTrendsSignalsSchema.optional(),
  reddit: RedditSignalsSchema.optional(),
  wikimedia: WikimediaSignalsSchema.optional(),
  guardian: GuardianSignalsSchema.optional(),
  warnings: z.array(z.string()).default([])
});

export const SignalsRequestSchema = z.object({
  keywords: z.array(z.string()).default([]),
  audience: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxKeywords: z.number().int().min(1).max(20).optional(),
  includeGoogleTrends: z.boolean().optional(),
  includeReddit: z.boolean().optional(),
  includeWikimedia: z.boolean().optional(),
  includeAllEntities: z.boolean().optional(),
  momentTitles: z.array(z.string()).max(30).optional()
});

export type GoogleTrendsSignals = z.infer<typeof GoogleTrendsSignalsSchema>;
export type RedditSignals = z.infer<typeof RedditSignalsSchema>;
export type WikimediaSignals = z.infer<typeof WikimediaSignalsSchema>;
export type GuardianSignals = z.infer<typeof GuardianSignalsSchema>;
export type SignalProviderDiagnostics = z.infer<typeof SignalProviderDiagnosticsSchema>;
export type SignalsBundle = z.infer<typeof SignalsBundleSchema>;
export type SignalsRequest = z.infer<typeof SignalsRequestSchema>;
