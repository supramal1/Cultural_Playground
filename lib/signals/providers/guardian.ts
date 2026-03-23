import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { SignalsProviderInput, SignalsProviderResult } from "@/lib/signals/providers/types";
import { isDemoMode, demoGuardianSignals } from "@/lib/signals/providers/demoFixtures";

const API_ROOT = "https://content.guardianapis.com";

export type GuardianArticle = {
  title: string;
  section: string;
  url: string;
  publishedAt: string;
  trailText?: string;
};

export type GuardianSignals = {
  articles: GuardianArticle[];
  topSections: string[];
  sources: Array<{ name: string; url?: string }>;
};

type GuardianApiResult = {
  id: string;
  webTitle: string;
  sectionName: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: {
    trailText?: string;
  };
};

type GuardianApiResponse = {
  response: {
    status: string;
    total: number;
    results: GuardianApiResult[];
  };
};

export async function collectGuardianSignals(
  input: SignalsProviderInput
): Promise<SignalsProviderResult<GuardianSignals>> {
  if (isDemoMode()) {
    return { data: demoGuardianSignals(), warnings: [] };
  }

  const apiKey = process.env.GUARDIAN_API_KEY || "test";
  const warnings: string[] = [];

  if (!process.env.GUARDIAN_API_KEY) {
    warnings.push("Using Guardian test API key — rate-limited. Set GUARDIAN_API_KEY for better limits.");
  }

  const keywords = input.keywords.slice(0, 5);
  if (keywords.length === 0) {
    return { data: undefined, warnings: ["No keywords provided for Guardian search."] };
  }

  const query = keywords.join(" OR ");

  try {
    const params = new URLSearchParams({
      q: query,
      "api-key": apiKey,
      "page-size": "15",
      "show-fields": "trailText",
      "order-by": "relevance"
    });

    if (input.from) {
      params.set("from-date", input.from);
    }
    if (input.to) {
      params.set("to-date", input.to);
    }

    const response = await fetchWithRetry(
      `${API_ROOT}/search?${params.toString()}`,
      { method: "GET" },
      { timeoutMs: 10_000, retries: 1, backoffMs: 1_000 }
    );

    const json = (await response.json()) as GuardianApiResponse;

    if (json.response.status !== "ok" || !json.response.results?.length) {
      return {
        data: {
          articles: [],
          topSections: [],
          sources: [{ name: "The Guardian", url: "https://www.theguardian.com" }]
        },
        warnings: ["Guardian returned no results for the query."]
      };
    }

    const articles: GuardianArticle[] = json.response.results.map((item) => ({
      title: item.webTitle,
      section: item.sectionName,
      url: item.webUrl,
      publishedAt: item.webPublicationDate,
      trailText: item.fields?.trailText
    }));

    const sectionCounts = new Map<string, number>();
    for (const article of articles) {
      sectionCounts.set(article.section, (sectionCounts.get(article.section) || 0) + 1);
    }
    const topSections = Array.from(sectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([section]) => section);

    return {
      data: {
        articles,
        topSections,
        sources: [{ name: "The Guardian", url: "https://www.theguardian.com" }]
      },
      warnings
    };
  } catch (error) {
    return {
      data: undefined,
      warnings: [`Guardian API failed: ${error instanceof Error ? error.message : "Unknown error"}`]
    };
  }
}
