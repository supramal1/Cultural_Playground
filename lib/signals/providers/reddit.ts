import {
  RedditSignalsSchema,
  type RedditSignals
} from "@/lib/signals/types";
import { runPythonJson } from "@/lib/signals/providers/subprocess";
import type {
  SignalsProviderInput,
  SignalsProviderResult
} from "@/lib/signals/providers/types";

type RedditRunnerPayload = {
  subredditCandidates?: unknown;
  topPosts?: unknown;
  commonThemes?: unknown;
  warnings?: unknown;
};

function normalizeSignals(payload: RedditRunnerPayload): RedditSignals {
  const parsed = RedditSignalsSchema.safeParse({
    subredditCandidates: Array.isArray(payload.subredditCandidates)
      ? payload.subredditCandidates
      : [],
    topPosts: Array.isArray(payload.topPosts) ? payload.topPosts : [],
    commonThemes: Array.isArray(payload.commonThemes) ? payload.commonThemes : [],
    sources: [{ name: "Reddit", url: "https://www.reddit.com/" }]
  });

  if (!parsed.success) {
    return {
      subredditCandidates: [],
      topPosts: [],
      commonThemes: [],
      sources: [{ name: "Reddit", url: "https://www.reddit.com/" }]
    };
  }

  return parsed.data;
}

export async function collectRedditSignals(
  input: SignalsProviderInput
): Promise<SignalsProviderResult<RedditSignals>> {
  if (input.keywords.length === 0) {
    return {
      data: {
        subredditCandidates: [],
        topPosts: [],
        commonThemes: [],
        sources: [{ name: "Reddit", url: "https://www.reddit.com/" }]
      },
      warnings: ["Reddit signals skipped: no signal keywords provided."]
    };
  }

  const result = await runPythonJson<RedditRunnerPayload>({
    scriptRelativePath: "lib/python/reddit_runner.py",
    payload: {
      keywords: input.keywords.slice(0, 8)
    },
    timeoutMs: 45_000
  });

  const warnings = [...result.warnings];

  if (!result.payload) {
    warnings.push("Reddit provider returned no data.");
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
