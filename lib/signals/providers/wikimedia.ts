import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import {
  WikimediaSignalsSchema,
  type WikimediaSignals
} from "@/lib/signals/types";
import type {
  SignalsProviderInput,
  SignalsProviderResult
} from "@/lib/signals/providers/types";

type WikimediaPageviewsItem = {
  timestamp?: string;
  views?: number;
};

type WikimediaPageviewsResponse = {
  items?: WikimediaPageviewsItem[];
};

function formatWikiDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}00`;
}

function toIsoDateFromWikiTimestamp(timestamp: string): string | null {
  if (!/^\d{10}$/.test(timestamp)) {
    return null;
  }
  const yyyy = timestamp.slice(0, 4);
  const mm = timestamp.slice(4, 6);
  const dd = timestamp.slice(6, 8);
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEntity(value: string): string {
  return value
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveEntityCandidates(input: SignalsProviderInput): string[] {
  const fromKeywords = input.keywords.map(normalizeEntity);
  const fromTitles = (input.momentTitles || []).map(normalizeEntity);

  const merged = [...fromKeywords, ...fromTitles]
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 3 && value.length <= 120);

  const seen = new Set<string>();
  const selected: string[] = [];

  for (const candidate of merged) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(candidate);
    if (selected.length >= 5) {
      break;
    }
  }

  return selected;
}

async function resolveBearerToken(): Promise<string | null> {
  const explicit = process.env.WIKIMEDIA_ACCESS_TOKEN;
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const clientId = process.env.WIKIMEDIA_CLIENT_ID;
  const clientSecret = process.env.WIKIMEDIA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    // TODO: validate exact OAuth endpoint against Wikimedia API Portal docs if token exchange requirements change.
    const response = await fetchWithRetry(
      "https://meta.wikimedia.org/w/rest.php/oauth2/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret
        }).toString()
      },
      { timeoutMs: 10_000, retries: 1 }
    );

    const payload = (await response.json()) as { access_token?: string };
    if (payload.access_token && payload.access_token.trim()) {
      return payload.access_token.trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchEntityViews(input: {
  title: string;
  project: string;
  start: string;
  end: string;
  token: string | null;
}): Promise<{ title: string; views: Array<{ date: string; views: number }>; total: number } | null> {
  const article = encodeURIComponent(input.title.replace(/\s+/g, "_"));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${encodeURIComponent(
    input.project
  )}/all-access/user/${article}/daily/${input.start}/${input.end}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: input.token
          ? {
              Authorization: `Bearer ${input.token}`
            }
          : undefined
      },
      { timeoutMs: 10_000, retries: 2 }
    );

    const payload = (await response.json()) as WikimediaPageviewsResponse;
    const items = Array.isArray(payload.items) ? payload.items : [];

    const views = items
      .flatMap((item) => {
        if (!item || typeof item.views !== "number" || typeof item.timestamp !== "string") {
          return [];
        }
        const date = toIsoDateFromWikiTimestamp(item.timestamp);
        if (!date) {
          return [];
        }
        return [{ date, views: item.views }];
      })
      .slice(-60);

    if (views.length === 0) {
      return null;
    }

    const total = views.reduce((sum, item) => sum + item.views, 0);
    return {
      title: input.title,
      views,
      total
    };
  } catch (error) {
    if (error instanceof FetchError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function collectWikimediaSignals(
  input: SignalsProviderInput
): Promise<SignalsProviderResult<WikimediaSignals>> {
  const warnings: string[] = [];
  const candidates = deriveEntityCandidates(input);
  if (candidates.length === 0) {
    return {
      data: {
        entities: [],
        sources: [{ name: "Wikimedia Pageviews", url: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews" }]
      },
      warnings: ["Wikimedia signals skipped: no entity candidates available."]
    };
  }

  // Always use the last 30 days for pageview data — we want *current* attention
  // levels, not future dates (which have no data).
  const now = new Date();
  const endDate = now;
  const startDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

  const start = formatWikiDate(startDate);
  const end = formatWikiDate(endDate);
  const project = process.env.WIKIMEDIA_PROJECT || "en.wikipedia";
  const token = await resolveBearerToken();
  if (!token) {
    warnings.push("No WIKIMEDIA_ACCESS_TOKEN set — using unauthenticated requests (may be rate-limited).");
  }

  const entities: Array<{ title: string; project: string; views: Array<{ date: string; views: number }>; total: number }> = [];

  for (const title of candidates) {
    try {
      const entity = await fetchEntityViews({
        title,
        project,
        start,
        end,
        token
      });

      if (entity) {
        entities.push({
          title: entity.title,
          project,
          views: entity.views,
          total: entity.total
        });
      }
    } catch (error) {
      warnings.push(
        `Wikimedia pageviews failed for ${title}: ${
          error instanceof Error ? error.message : "unexpected error"
        }`
      );
    }
  }

  entities.sort((a, b) => b.total - a.total);

  const parsed = WikimediaSignalsSchema.safeParse({
    entities: entities.slice(0, 5),
    sources: [{ name: "Wikimedia Pageviews", url: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews" }]
  });

  if (!parsed.success) {
    warnings.push(`Wikimedia normalization failed: ${parsed.error.issues[0]?.message || "schema mismatch"}`);
    return { warnings };
  }

  return {
    data: parsed.data,
    warnings
  };
}
