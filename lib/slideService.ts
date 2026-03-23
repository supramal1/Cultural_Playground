import { z } from "zod";
import {
  DEFAULT_OPENAI_MODEL,
  MAX_DATE_RANGE_DAYS,
  OPENAI_BASE_URL,
  SYNTHESIS_TOP_N
} from "@/lib/config";
import { FetchError, fetchWithRetry } from "@/lib/fetchWithRetry";
import { ScoredMomentSchema, type ScoredMoment } from "@/lib/schemas/moment";
import { SynthesisSchema, type Synthesis } from "@/lib/schemas/synthesis";
import { SlideSchema, slideJsonSchema, type Slide } from "@/lib/schemas/slide";
import { resolveSingleCharTypoId } from "@/lib/idNormalization";

export const SlideRequestSchema = z.object({
  moments: z.array(ScoredMomentSchema).min(1),
  synthesis: SynthesisSchema.optional(),
  audience: z.string().optional(),
  brandConstraints: z.string().optional(),
  includeAll: z.boolean().optional().default(false)
});

export type SlideRequest = z.infer<typeof SlideRequestSchema>;

function describeOpenAiFetchError(error: FetchError): string {
  if (!error.bodyText) {
    return `OpenAI call failed: ${error.message}`;
  }

  try {
    const parsed = JSON.parse(error.bodyText) as { error?: { message?: string } };
    const apiMessage = parsed.error?.message;
    if (apiMessage) {
      return `OpenAI call failed: ${error.message}. ${apiMessage}`;
    }
  } catch {
    // Fall through to raw body snippet when response is not JSON.
  }

  return `OpenAI call failed: ${error.message}. ${error.bodyText.slice(0, 300)}`;
}

function rangeWithinLimit(moments: ScoredMoment[]): boolean {
  if (moments.length === 0) {
    return true;
  }

  const sorted = [...moments].sort(
    (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
  );
  const first = new Date(sorted[0].startDateTime).getTime();
  const last = new Date(sorted[sorted.length - 1].startDateTime).getTime();
  const days = Math.floor((last - first) / (24 * 60 * 60 * 1000));
  return days <= MAX_DATE_RANGE_DAYS;
}

function topMomentsForLlm(moments: ScoredMoment[], includeAll: boolean): ScoredMoment[] {
  if (includeAll) {
    return moments;
  }
  return [...moments].sort((a, b) => b.score - a.score).slice(0, SYNTHESIS_TOP_N);
}

function extractStructuredJson(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response payload malformed.");
  }

  const asAny = payload as Record<string, unknown>;
  if (typeof asAny.output_text === "string" && asAny.output_text.trim()) {
    return JSON.parse(asAny.output_text);
  }

  const output = asAny.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const segment of content) {
        const typed = segment as { text?: unknown; json?: unknown };
        if (typeof typed.text === "string" && typed.text.trim()) {
          return JSON.parse(typed.text);
        }
        if (typed.json && typeof typed.json === "object") {
          return typed.json;
        }
      }
    }
  }

  throw new Error("Could not extract structured JSON from OpenAI response.");
}

function systemPrompt(): string {
  return [
    "You generate one planning slide from provided moments.",
    "Use only provided moment ids and optional synthesis.",
    "Do not invent any factual details.",
    "Do not add dates/times/venues/opponents/titles in prose.",
    "Moment callouts must reference only momentId values from the allowed set."
  ].join(" ");
}

function userPrompt(input: {
  moments: ScoredMoment[];
  synthesis?: Synthesis;
  audience?: string;
  brandConstraints?: string;
  corrective?: { invalidIds: string[]; allowedIds: string[] };
}): string {
  const lines = [
    `Audience: ${input.audience || "General UK planners"}`,
    `Brand constraints: ${input.brandConstraints || "None"}`,
    `Moments JSON:\n${JSON.stringify(input.moments)}`,
    input.synthesis ? `Synthesis JSON:\n${JSON.stringify(input.synthesis)}` : "Synthesis JSON: not provided"
  ];

  if (input.corrective) {
    lines.push(
      `Correction required: invalid moment ids were ${input.corrective.invalidIds.join(", ")}.`,
      `Allowed ids only: ${input.corrective.allowedIds.join(", ")}.`
    );
  }

  return lines.join("\n\n");
}

export function invalidSlideReferencedIds(slide: Slide, allowedIds: Set<string>): string[] {
  return slide.momentCallouts
    .map((callout) => callout.momentId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => !allowedIds.has(id));
}

export function normalizeSlideReferencedIds(slide: Slide, allowedIds: Set<string>): Slide {
  return {
    ...slide,
    momentCallouts: slide.momentCallouts.map((callout) => ({
      ...callout,
      momentId: resolveSingleCharTypoId(callout.momentId, allowedIds) || callout.momentId
    }))
  };
}

async function callOpenAiForSlide(input: {
  moments: ScoredMoment[];
  synthesis?: Synthesis;
  audience?: string;
  brandConstraints?: string;
  corrective?: { invalidIds: string[]; allowedIds: string[] };
}): Promise<Slide> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const response = await fetchWithRetry(
    `${OPENAI_BASE_URL}/responses`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt() }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt(input) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: slideJsonSchema.name,
            schema: slideJsonSchema.schema,
            strict: true
          }
        }
      })
    },
    { timeoutMs: 30_000, retries: 2, backoffMs: 500 }
  );

  const payload = await response.json();
  const structured = extractStructuredJson(payload);
  const parsed = SlideSchema.safeParse(structured);
  if (!parsed.success) {
    throw new Error(`Slide schema validation failed: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export async function generateSlide(input: SlideRequest): Promise<{ slide: Slide; usedMoments: ScoredMoment[] }> {
  if (!rangeWithinLimit(input.moments)) {
    throw new Error(`Date range exceeds max of ${MAX_DATE_RANGE_DAYS} days.`);
  }

  const usedMoments = topMomentsForLlm(input.moments, Boolean(input.includeAll));
  const allowedIds = new Set(usedMoments.map((moment) => moment.id));

  let first: Slide;
  try {
    first = await callOpenAiForSlide({
      moments: usedMoments,
      synthesis: input.synthesis,
      audience: input.audience,
      brandConstraints: input.brandConstraints
    });
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(describeOpenAiFetchError(error));
    }
    throw error;
  }

  const normalizedFirst = normalizeSlideReferencedIds(first, allowedIds);
  const firstInvalid = invalidSlideReferencedIds(normalizedFirst, allowedIds);
  if (firstInvalid.length === 0) {
    return { slide: normalizedFirst, usedMoments };
  }

  let second: Slide;
  try {
    second = await callOpenAiForSlide({
      moments: usedMoments,
      synthesis: input.synthesis,
      audience: input.audience,
      brandConstraints: input.brandConstraints,
      corrective: {
        invalidIds: firstInvalid,
        allowedIds: Array.from(allowedIds)
      }
    });
  } catch (error) {
    if (error instanceof FetchError) {
      throw new Error(describeOpenAiFetchError(error));
    }
    throw error;
  }

  const normalizedSecond = normalizeSlideReferencedIds(second, allowedIds);
  const secondInvalid = invalidSlideReferencedIds(normalizedSecond, allowedIds);
  if (secondInvalid.length > 0) {
    const message = `Invalid slide moment ids after retry: ${secondInvalid.join(", ")}`;
    const error = new Error(message) as Error & {
      invalidIds?: string[];
      allowedIds?: string[];
    };
    error.invalidIds = secondInvalid;
    error.allowedIds = Array.from(allowedIds);
    throw error;
  }

  return { slide: normalizedSecond, usedMoments };
}
