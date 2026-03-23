import { z } from "zod";
import { MAX_DATE_RANGE_DAYS } from "@/lib/config";
import { combineKeywordSets } from "@/lib/insights/deriveKeywords";
import { collectMoments } from "@/lib/momentsService";

export const runtime = "nodejs";

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categories: z.string().optional(),
  boost: z.string().optional(),
  insightsKeywords: z.string().optional(),
  audience: z.string().optional(),
  brandConstraints: z.string().optional(),
  city: z.string().optional(),
  refresh: z.string().optional()
});

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

function parseCsv(input: string | undefined): string[] {
  if (!input) {
    return [];
  }
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && item.length <= 64);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const defaults = defaultRange();

  const parsed = QuerySchema.safeParse({
    from: url.searchParams.get("from") || defaults.from,
    to: url.searchParams.get("to") || defaults.to,
    categories: url.searchParams.get("categories") || undefined,
    boost: url.searchParams.get("boost") || undefined,
    insightsKeywords: url.searchParams.get("insightsKeywords") || undefined,
    audience: url.searchParams.get("audience") || undefined,
    brandConstraints: url.searchParams.get("brandConstraints") || undefined,
    city: url.searchParams.get("city") || undefined,
    refresh: url.searchParams.get("refresh") || undefined
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const from = parsed.data.from;
  const to = parsed.data.to;
  const categories = parseCsv(parsed.data.categories);
  const userKeywords = parseCsv(parsed.data.boost);
  const insightsKeywordsRaw = parseCsv(parsed.data.insightsKeywords);
  const cappedInsightsKeywords = insightsKeywordsRaw.slice(0, 40);
  const keywordSet = combineKeywordSets({
    userKeywords,
    insightsKeywords: cappedInsightsKeywords,
    cap: 40
  });
  const forceRefresh = parsed.data.refresh === "1" || parsed.data.refresh === "true";

  const fromTime = new Date(`${from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${to}T00:00:00.000Z`).getTime();
  if (toTime < fromTime) {
    return Response.json(
      {
        error: "Invalid date range",
        details: "`to` must be on or after `from`."
      },
      { status: 400 }
    );
  }

  const days = Math.floor((toTime - fromTime) / (24 * 60 * 60 * 1000));
  if (days > MAX_DATE_RANGE_DAYS) {
    return Response.json(
      {
        error: "Date range too large",
        details: `Maximum range is ${MAX_DATE_RANGE_DAYS} days.`
      },
      { status: 400 }
    );
  }

  try {
    const data = await collectMoments({
      from,
      to,
      categories,
      keywords: keywordSet.combined,
      audience: parsed.data.audience,
      brandConstraints: parsed.data.brandConstraints,
      city: parsed.data.city,
      forceRefresh
    });
    return Response.json({
      ...data,
      meta: {
        ...data.meta,
        keywordSources: {
          user: keywordSet.userCount,
          insights: keywordSet.insightsCount
        }
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to collect moments",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
