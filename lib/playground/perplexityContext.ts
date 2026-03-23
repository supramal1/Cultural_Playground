import { z } from "zod";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry, FetchError } from "@/lib/fetchWithRetry";
import { PlaygroundBriefSchema, PlaygroundCandidateSchema, PlanMomentSchema } from "@/lib/playground/types";

const PERPLEXITY_BASE_URL = process.env.PERPLEXITY_BASE_URL || "https://api.perplexity.ai";
const DEFAULT_PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar";

const PerplexitySourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url()
});

export const PlaygroundContextItemSchema = z.object({
  playgroundId: z.string().min(1),
  validation: z.string().min(1),
  anchors: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url()
      })
    )
    .max(3)
    .default([]),
  safetyNotes: z.array(z.string()).max(4).default([]),
  evidencePointers: z.array(z.string()).max(8).default([])
});

export const PlaygroundContextResponseSchema = z.object({
  byPlaygroundId: z.record(z.string(), PlaygroundContextItemSchema),
  sources: z.array(PerplexitySourceSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export const PlaygroundContextRequestSchema = z.object({
  brief: PlaygroundBriefSchema,
  candidates: z.array(PlaygroundCandidateSchema).min(1).max(8),
  options: z
    .object({
      refresh: z.boolean().optional()
    })
    .optional()
});

export const OpportunityContextItemSchema = z.object({
  momentId: z.string().min(1),
  whyNowBullets: z.array(z.string()).min(1).max(2).default([]),
  adjacencyRisk: z.string().min(1),
  citations: z.array(PerplexitySourceSchema).max(3).default([]),
  evidencePointers: z.array(z.string()).max(8).default([])
});

export const OpportunityContextResponseSchema = z.object({
  byMomentId: z.record(z.string(), OpportunityContextItemSchema),
  sources: z.array(PerplexitySourceSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export const OpportunityContextRequestSchema = z.object({
  brief: PlaygroundBriefSchema,
  playground: z.object({
    id: z.string().min(1),
    name: z.string().min(1)
  }),
  topMoments: z.array(PlanMomentSchema).max(5),
  options: z
    .object({
      refresh: z.boolean().optional()
    })
    .optional()
});

export type PlaygroundContextRequest = z.infer<typeof PlaygroundContextRequestSchema>;
export type PlaygroundContextResponse = z.infer<typeof PlaygroundContextResponseSchema>;
export type OpportunityContextRequest = z.infer<typeof OpportunityContextRequestSchema>;
export type OpportunityContextResponse = z.infer<typeof OpportunityContextResponseSchema>;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parsePerplexityJson(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Perplexity response content empty.");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Perplexity response did not contain valid JSON.");
  }
}

function extractSources(payload: unknown): Array<{ title: string; url: string }> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates: Array<{ title: string; url: string }> = [];
  const asAny = payload as { citations?: unknown; search_results?: unknown };

  const push = (title: unknown, url: unknown): void => {
    if (typeof url !== "string") {
      return;
    }
    try {
      const normalizedUrl = new URL(url).toString();
      candidates.push({
        title: typeof title === "string" && normalize(title) ? normalize(title) : "Source",
        url: normalizedUrl
      });
    } catch {
      // ignore invalid source url
    }
  };

  if (Array.isArray(asAny.citations)) {
    for (const item of asAny.citations) {
      if (typeof item === "string") {
        push("Source", item);
      } else if (item && typeof item === "object") {
        const typed = item as { title?: unknown; url?: unknown };
        push(typed.title, typed.url);
      }
    }
  }

  if (Array.isArray(asAny.search_results)) {
    for (const item of asAny.search_results) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const typed = item as { title?: unknown; url?: unknown };
      push(typed.title, typed.url);
    }
  }

  const deduped = new Map<string, { title: string; url: string }>();
  for (const item of candidates) {
    if (!deduped.has(item.url)) {
      deduped.set(item.url, item);
    }
  }

  return Array.from(deduped.values()).slice(0, 12);
}

function normalizeAnchorUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "utm_id",
      "gclid",
      "fbclid"
    ].forEach((param) => url.searchParams.delete(param));
    return url.toString().replace(/\/+$/, "");
  } catch {
    return normalize(value);
  }
}

async function callPerplexityJson(input: {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
}): Promise<{ json: unknown; sources: Array<{ title: string; url: string }> }> {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY missing");
  }

  const response = await fetchWithRetry(
    `${PERPLEXITY_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: DEFAULT_PERPLEXITY_MODEL,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ],
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: input.jsonSchema
          }
        }
      })
    },
    {
      timeoutMs: 45_000,
      retries: 2,
      backoffMs: 500
    }
  );

  const payload = await response.json();
  const asAny = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = asAny.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Perplexity content missing");
  }

  return {
    json: parsePerplexityJson(content),
    sources: extractSources(payload)
  };
}

export async function generatePlaygroundContext(input: PlaygroundContextRequest): Promise<{
  context: PlaygroundContextResponse;
  cache: "hit" | "miss";
}> {
  const parsed = PlaygroundContextRequestSchema.parse(input);

  if (!process.env.PERPLEXITY_API_KEY) {
    return {
      context: {
        byPlaygroundId: {},
        sources: [],
        warnings: ["Perplexity disabled: PERPLEXITY_API_KEY missing."]
      },
      cache: "miss"
    };
  }

  const { payload, cache } = await withConnectorCache({
    connector: "playground-context-v3",
    params: {
      brief: parsed.brief,
      candidates: parsed.candidates.map((item) => ({ id: item.id, name: item.name, keywords: item.keywords.core })),
      model: DEFAULT_PERPLEXITY_MODEL
    },
    keyPresent: true,
    forceRefresh: Boolean(parsed.options?.refresh),
    fetcher: async () => {
      const system = [
        "You validate cultural playground candidates for UK media planning.",
        "Return JSON only.",
        "For each playground: short validation, 2-3 mainstream anchors with URLs, and safety notes.",
        "Anchors must be specific to each playground and should not repeat the same URL across different playgrounds unless unavoidable."
      ].join(" ");

      const user = JSON.stringify({
        brief: parsed.brief,
        candidates: parsed.candidates.map((item) => ({
          id: item.id,
          name: item.name,
          definition: item.definition,
          keywords: item.keywords.core,
          communities: item.communities.subreddits
        }))
      });

      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                playgroundId: { type: "string" },
                validation: { type: "string" },
                anchors: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      label: { type: "string" },
                      url: { type: "string" }
                    },
                    required: ["label", "url"]
                  }
                },
                safetyNotes: {
                  type: "array",
                  maxItems: 4,
                  items: { type: "string" }
                }
              },
              required: ["playgroundId", "validation", "anchors", "safetyNotes"]
            }
          }
        },
        required: ["items"]
      };

      const warnings: string[] = [];
      try {
        const result = await callPerplexityJson({ system, user, jsonSchema: schema });
        const parsedJson = z.object({ items: z.array(PlaygroundContextItemSchema.omit({ evidencePointers: true })) }).parse(result.json);
        const byPlaygroundId: Record<string, z.infer<typeof PlaygroundContextItemSchema>> = {};
        const usedAnchorUrls = new Set<string>();
        for (const item of parsedJson.items) {
          if (!parsed.candidates.some((candidate) => candidate.id === item.playgroundId)) {
            continue;
          }

          const uniqueAnchors = item.anchors.filter((anchor) => {
            const key = normalizeAnchorUrl(anchor.url);
            if (usedAnchorUrls.has(key)) {
              return false;
            }
            usedAnchorUrls.add(key);
            return true;
          });

          const anchors = uniqueAnchors.slice(0, 3);
          byPlaygroundId[item.playgroundId] = {
            ...item,
            anchors,
            evidencePointers: [
              ...anchors.map((_anchor, index) => `playgroundContext.${item.playgroundId}.anchors[${index}]`)
            ]
          };
        }

        return PlaygroundContextResponseSchema.parse({
          byPlaygroundId,
          sources: result.sources,
          warnings
        });
      } catch (error) {
        if (error instanceof FetchError) {
          warnings.push(`Perplexity playground-context failed: ${error.message}`);
        } else {
          warnings.push(error instanceof Error ? error.message : "Perplexity playground-context failed.");
        }
        return PlaygroundContextResponseSchema.parse({ byPlaygroundId: {}, sources: [], warnings });
      }
    }
  });

  return { context: payload, cache };
}

export async function generateOpportunityContext(input: OpportunityContextRequest): Promise<{
  context: OpportunityContextResponse;
  cache: "hit" | "miss";
}> {
  const parsed = OpportunityContextRequestSchema.parse(input);

  if (!process.env.PERPLEXITY_API_KEY) {
    return {
      context: {
        byMomentId: {},
        sources: [],
        warnings: ["Perplexity disabled: PERPLEXITY_API_KEY missing."]
      },
      cache: "miss"
    };
  }

  const topMoments = parsed.topMoments.slice(0, 5);
  const { payload, cache } = await withConnectorCache({
    connector: "opportunity-context-v3",
    params: {
      brief: parsed.brief,
      playground: parsed.playground,
      moments: topMoments.map((moment) => ({ id: moment.id, title: moment.title, tags: moment.tags }))
    },
    keyPresent: true,
    forceRefresh: Boolean(parsed.options?.refresh),
    fetcher: async () => {
      const system = [
        "You provide contextual why-now notes for moment IDs.",
        "Return JSON only.",
        "Do not invent event facts. Provide generic context and citations."
      ].join(" ");

      const user = JSON.stringify({
        brief: parsed.brief,
        playground: parsed.playground,
        moments: topMoments.map((moment) => ({
          id: moment.id,
          category: moment.category,
          tags: moment.tags,
          evidencePointers: moment.evidencePointers
        }))
      });

      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                momentId: { type: "string" },
                whyNowBullets: { type: "array", minItems: 1, maxItems: 2, items: { type: "string" } },
                adjacencyRisk: { type: "string" },
                citations: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" }
                    },
                    required: ["title", "url"]
                  }
                }
              },
              required: ["momentId", "whyNowBullets", "adjacencyRisk", "citations"]
            }
          }
        },
        required: ["items"]
      };

      const warnings: string[] = [];
      try {
        const result = await callPerplexityJson({ system, user, jsonSchema: schema });
        const parsedJson = z.object({ items: z.array(OpportunityContextItemSchema.omit({ evidencePointers: true })) }).parse(result.json);
        const allowed = new Set(topMoments.map((moment) => moment.id));
        const byMomentId: Record<string, z.infer<typeof OpportunityContextItemSchema>> = {};
        for (const item of parsedJson.items) {
          if (!allowed.has(item.momentId)) {
            continue;
          }
          byMomentId[item.momentId] = {
            ...item,
            evidencePointers: item.citations.map((_citation, index) => `opportunityContext.${item.momentId}.citations[${index}]`)
          };
        }

        return OpportunityContextResponseSchema.parse({
          byMomentId,
          sources: result.sources,
          warnings
        });
      } catch (error) {
        if (error instanceof FetchError) {
          warnings.push(`Perplexity opportunity-context failed: ${error.message}`);
        } else {
          warnings.push(error instanceof Error ? error.message : "Perplexity opportunity-context failed.");
        }
        return OpportunityContextResponseSchema.parse({ byMomentId: {}, sources: [], warnings });
      }
    }
  });

  return { context: payload, cache };
}
