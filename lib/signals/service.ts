import { withConnectorCache } from "@/lib/cache";
import {
  SignalProviderDiagnosticsSchema,
  SignalsBundleSchema,
  SignalsRequestSchema,
  type SignalProviderDiagnostics,
  type SignalsBundle,
  type SignalsRequest
} from "@/lib/signals/types";
import type {
  GoogleTrendsSignals,
  RedditSignals,
  WikimediaSignals,
  GuardianSignals
} from "@/lib/signals/types";
import { collectGoogleTrendsSignals } from "@/lib/signals/providers/googleTrends";
import { collectRedditSignals } from "@/lib/signals/providers/reddit";
import { collectWikimediaSignals } from "@/lib/signals/providers/wikimedia";
import { collectGuardianSignals } from "@/lib/signals/providers/guardian";
import type { SignalsProviderInput, SignalsProviderResult } from "@/lib/signals/providers/types";

type ProviderKey = "googleTrends" | "reddit" | "wikimedia" | "guardian";

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 29);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
}

function normalizeKeyword(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function selectSignalKeywords(input: {
  keywords: string[];
  maxKeywords?: number;
}): string[] {
  const cap = Math.min(20, Math.max(1, input.maxKeywords ?? 20));
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const raw of input.keywords) {
    const normalized = normalizeKeyword(raw);
    if (!normalized) {
      continue;
    }
    const canonical = normalized.toLowerCase();
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    selected.push(normalized);
    if (selected.length >= cap) {
      break;
    }
  }

  return selected;
}

function providerToggle(input: SignalsRequest, key: "google" | "reddit" | "wikimedia"): boolean {
  if (key === "google") {
    if (typeof input.includeGoogleTrends === "boolean") {
      return input.includeGoogleTrends;
    }
    return process.env.ENABLE_GOOGLE_TRENDS_SIGNALS !== "0";
  }

  if (key === "reddit") {
    if (typeof input.includeReddit === "boolean") {
      return input.includeReddit;
    }
    return process.env.ENABLE_REDDIT_SIGNALS !== "0";
  }

  if (typeof input.includeWikimedia === "boolean") {
    return input.includeWikimedia;
  }
  return process.env.ENABLE_WIKIMEDIA_SIGNALS !== "0";
}

function providerToggleGuardian(): boolean {
  return process.env.ENABLE_GUARDIAN_SIGNALS !== "0";
}

function normalizeProviderDiagnostics(
  diagnostics: SignalProviderDiagnostics,
  cache: "hit" | "miss"
): SignalProviderDiagnostics {
  const parsed = SignalProviderDiagnosticsSchema.parse({
    ...diagnostics,
    cache
  });
  return parsed;
}

function itemCountForProvider(key: ProviderKey, data?: GoogleTrendsSignals | RedditSignals | WikimediaSignals | GuardianSignals): number {
  if (!data) {
    return 0;
  }
  if (key === "googleTrends") {
    const typed = data as GoogleTrendsSignals;
    return typed.topRelatedQueries.length + typed.topRelatedTopics.length + typed.interestOverTime.length;
  }
  if (key === "reddit") {
    const typed = data as RedditSignals;
    return typed.topPosts.length + typed.commonThemes.length + typed.subredditCandidates.length;
  }
  if (key === "guardian") {
    const typed = data as GuardianSignals;
    return typed.articles.length;
  }
  const typed = data as WikimediaSignals;
  return typed.entities.length;
}

async function runProvider<T>(input: {
  key: ProviderKey;
  enabled: boolean;
  providerInput: SignalsProviderInput;
  run: (payload: SignalsProviderInput) => Promise<SignalsProviderResult<T>>;
}): Promise<{
  data?: T;
  diagnostics: SignalProviderDiagnostics;
  warnings: string[];
}> {
  if (!input.enabled) {
    return {
      data: undefined,
      diagnostics: {
        status: "SKIPPED",
        ms: 0,
        cache: "n/a",
        items: 0,
        message: "Provider disabled by config."
      },
      warnings: []
    };
  }

  const startedAt = Date.now();
  try {
    const result = await input.run(input.providerInput);
    const ms = Date.now() - startedAt;
    const items = itemCountForProvider(
      input.key,
      result.data as GoogleTrendsSignals | RedditSignals | WikimediaSignals | GuardianSignals | undefined
    );
    const warnings = result.warnings.map((warning) => `${input.key}: ${warning}`);

    const failed = !result.data;
    return {
      data: result.data,
      diagnostics: {
        status: failed ? "FAILED" : "OK",
        ms,
        cache: "n/a",
        items,
        errorType: failed ? "PROVIDER_NO_DATA" : undefined,
        message: failed ? result.warnings[0] || "Provider returned no data." : result.warnings[0]
      },
      warnings
    };
  } catch (error) {
    const ms = Date.now() - startedAt;
    return {
      data: undefined,
      diagnostics: {
        status: "FAILED",
        ms,
        cache: "n/a",
        items: 0,
        errorType: error instanceof Error ? error.name : "UnexpectedError",
        message: error instanceof Error ? error.message : "Provider failed unexpectedly."
      },
      warnings: [
        `${input.key}: ${error instanceof Error ? error.message : "Provider failed unexpectedly."}`
      ]
    };
  }
}

export async function generateSignals(input: SignalsRequest): Promise<{
  signals: SignalsBundle;
  cache: "hit" | "miss";
  providers: SignalsBundle["meta"]["providers"];
}> {
  const parsed = SignalsRequestSchema.parse(input);

  const defaults = defaultDateRange();
  const from = parsed.from || defaults.from;
  const to = parsed.to || defaults.to;
  const keywords = selectSignalKeywords({
    keywords: parsed.keywords,
    maxKeywords: parsed.maxKeywords
  });

  const enableGoogle = providerToggle(parsed, "google");
  const enableReddit = providerToggle(parsed, "reddit");
  const enableWikimedia = providerToggle(parsed, "wikimedia");
  const enableGuardian = providerToggleGuardian();

  const { payload, cache } = await withConnectorCache({
    connector: "signals-bundle",
    params: {
      keywords,
      audience: parsed.audience || "",
      from,
      to,
      enableGoogle,
      enableReddit,
      enableWikimedia,
      enableGuardian
    },
    keyPresent: true,
    fetcher: async () => {
      const warnings: string[] = [];

      const providerInput = {
        keywords,
        audience: parsed.audience,
        from,
        to,
        momentTitles: parsed.momentTitles
      };

      const [google, reddit, wikimedia, guardian] = await Promise.all([
        runProvider({
          key: "googleTrends",
          enabled: enableGoogle,
          providerInput,
          run: collectGoogleTrendsSignals
        }),
        runProvider({
          key: "reddit",
          enabled: enableReddit,
          providerInput,
          run: collectRedditSignals
        }),
        runProvider({
          key: "wikimedia",
          enabled: enableWikimedia,
          providerInput,
          run: collectWikimediaSignals
        }),
        runProvider({
          key: "guardian",
          enabled: enableGuardian,
          providerInput,
          run: collectGuardianSignals
        })
      ]);

      warnings.push(...google.warnings);
      warnings.push(...reddit.warnings);
      warnings.push(...wikimedia.warnings);
      warnings.push(...guardian.warnings);

      const candidate = {
        meta: {
          generatedAt: new Date().toISOString(),
          inputs: {
            keywords,
            audience: parsed.audience,
            dateRange: { from, to }
          },
          providers: {
            googleTrends: google.diagnostics,
            reddit: reddit.diagnostics,
            wikimedia: wikimedia.diagnostics,
            guardian: guardian.diagnostics
          }
        },
        googleTrends: google.data,
        reddit: reddit.data,
        wikimedia: wikimedia.data,
        guardian: guardian.data,
        warnings
      };

      const normalized = SignalsBundleSchema.safeParse(candidate);
      if (!normalized.success) {
        throw new Error(`Signals bundle validation failed: ${normalized.error.issues[0]?.message}`);
      }

      return normalized.data;
    }
  });

  return {
    signals: {
      ...payload,
      meta: {
        ...payload.meta,
        providers: {
          googleTrends: normalizeProviderDiagnostics(payload.meta.providers.googleTrends, cache),
          reddit: normalizeProviderDiagnostics(payload.meta.providers.reddit, cache),
          wikimedia: normalizeProviderDiagnostics(payload.meta.providers.wikimedia, cache),
          guardian: normalizeProviderDiagnostics(payload.meta.providers.guardian, cache)
        }
      }
    },
    cache,
    providers: {
      googleTrends: normalizeProviderDiagnostics(payload.meta.providers.googleTrends, cache),
      reddit: normalizeProviderDiagnostics(payload.meta.providers.reddit, cache),
      wikimedia: normalizeProviderDiagnostics(payload.meta.providers.wikimedia, cache),
      guardian: normalizeProviderDiagnostics(payload.meta.providers.guardian, cache)
    }
  };
}
