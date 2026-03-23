import {
  GoogleTrendsSignalsSchema,
  type GoogleTrendsSignals
} from "@/lib/signals/types";
import { runPythonJson } from "@/lib/signals/providers/subprocess";
import type {
  SignalsProviderInput,
  SignalsProviderResult
} from "@/lib/signals/providers/types";
import { isDemoMode, demoGoogleTrendsSignals } from "@/lib/signals/providers/demoFixtures";

type GoogleRunnerPayload = {
  topRelatedQueries?: Array<{ query?: unknown; type?: unknown; value?: unknown }>;
  topRelatedTopics?: Array<{ topic?: unknown; type?: unknown; value?: unknown }>;
  interestOverTime?: Array<{ date?: unknown; value?: unknown }>;
  warnings?: unknown;
};

function normalizeSignals(payload: GoogleRunnerPayload): GoogleTrendsSignals {
  const parsed = GoogleTrendsSignalsSchema.safeParse({
    topRelatedQueries: Array.isArray(payload.topRelatedQueries)
      ? payload.topRelatedQueries
      : [],
    topRelatedTopics: Array.isArray(payload.topRelatedTopics)
      ? payload.topRelatedTopics
      : [],
    interestOverTime: Array.isArray(payload.interestOverTime)
      ? payload.interestOverTime
      : [],
    sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
  });

  if (!parsed.success) {
    return {
      topRelatedQueries: [],
      topRelatedTopics: [],
      interestOverTime: [],
      sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
    };
  }

  return parsed.data;
}

export async function collectGoogleTrendsSignals(
  input: SignalsProviderInput
): Promise<SignalsProviderResult<GoogleTrendsSignals>> {
  if (isDemoMode()) {
    return { data: demoGoogleTrendsSignals(), warnings: [] };
  }

  if (input.keywords.length === 0) {
    return {
      data: {
        topRelatedQueries: [],
        topRelatedTopics: [],
        interestOverTime: [],
        sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
      },
      warnings: ["Google Trends skipped: no signal keywords provided."]
    };
  }

  const result = await runPythonJson<GoogleRunnerPayload>({
    scriptRelativePath: "lib/python/google_trends_runner.py",
    payload: {
      keywords: input.keywords.slice(0, 5),
      geo: "GB",
      from: input.from,
      to: input.to
    },
    timeoutMs: 30_000
  });

  const warnings = [...result.warnings];

  if (!result.payload) {
    warnings.push("Google Trends provider returned no data.");
    return { warnings };
  }

  if (Array.isArray(result.payload.warnings)) {
    for (const item of result.payload.warnings) {
      if (typeof item === "string" && item.trim()) {
        warnings.push(item.trim());
      }
    }
  }

  const data = normalizeSignals(result.payload);
  return {
    data,
    warnings
  };
}
