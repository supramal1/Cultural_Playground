import { z } from "zod";
import { PlanDataSchema } from "@/lib/playground/types";
import { SynthesisV2Schema } from "@/lib/synthesisSchemaV2";
import { SlideSchema, type Slide } from "@/lib/schemas/slide";
import { MediaOwnerBriefSchema } from "@/lib/briefBuilder/types";

export const SlideV2RequestSchema = z.object({
  version: z.literal("v2").optional(),
  schemaVersion: z.literal(2).optional(),
  planData: PlanDataSchema.optional(),
  synthesis: SynthesisV2Schema.optional(),
  mediaOwnerBrief: MediaOwnerBriefSchema.optional(),
  playgroundName: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional()
}).refine((value) => {
  const legacyMode = Boolean(value.planData && value.synthesis);
  const briefMode = Boolean(value.mediaOwnerBrief);
  return legacyMode || briefMode;
}, {
  message: "Provide either {planData + synthesis} or {mediaOwnerBrief}."
});

export type SlideV2Request = z.infer<typeof SlideV2RequestSchema>;

function uniqueList(values: string[], cap: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
    if (output.length >= cap) {
      break;
    }
  }
  return output;
}

export function generateSlideV2(input: SlideV2Request): { slide: Slide } {
  if (input.mediaOwnerBrief) {
    const dateRange = input.from && input.to ? `${input.from} to ${input.to}` : "Current planning window";
    const titlePrefix = input.playgroundName ? `${input.playgroundName}` : "Selected playground";
    const slide = SlideSchema.parse({
      slideTitle: `UK Cultural Playground: ${titlePrefix} - ${dateRange}`,
      subtitle: input.mediaOwnerBrief.briefOneLiner,
      keyTakeaways: [
        input.mediaOwnerBrief.objectiveKpi,
        input.mediaOwnerBrief.audienceMindset,
        input.mediaOwnerBrief.theAsk
      ].slice(0, 5),
      momentCallouts: input.mediaOwnerBrief.momentsToBuildAround.slice(0, 4).map((item) => ({
        momentId: item.momentId,
        label: item.actionBullets[0] || "Moment callout",
        whyRelevant: item.actionBullets[1] || item.actionBullets[0] || "Relevant to brief objective."
      })),
      activationAngles: input.mediaOwnerBrief.deliverables.slice(0, 5),
      recommendedChannels: input.mediaOwnerBrief.deliverables.slice(0, 6),
      risksAndGuardrails: input.mediaOwnerBrief.guardrails.slice(0, 4),
      speakerNotes: input.mediaOwnerBrief.playgroundDefinitionCodes,
      confidenceNote: input.mediaOwnerBrief.proofAppendix.citations[0] || "Evidence-backed brief"
    });

    return { slide };
  }

  if (!input.planData || !input.synthesis) {
    throw new Error("Missing planData/synthesis for legacy slide generation.");
  }

  const momentById = new Map(input.planData.moments.map((moment) => [moment.id, moment]));
  const topOpportunities = input.synthesis.opportunities.slice(0, 5);

  const keyTakeaways = uniqueList(
    topOpportunities.flatMap((item) => item.whatToDo).slice(0, 6),
    5
  );
  const fallbackTakeaways = input.synthesis.themes
    .slice(0, 3)
    .map((theme) => theme.whatsHappening);

  const momentCallouts = topOpportunities
    .slice(0, 4)
    .map((opportunity) => ({
      momentId: opportunity.momentId,
      label: opportunity.audienceHook,
      whyRelevant: opportunity.whyItMatters
    }))
    .filter((item) => momentById.has(item.momentId));

  const activationAngles = uniqueList(
    input.synthesis.themes.flatMap((theme) => theme.activationAngles),
    5
  );
  const recommendedChannels = uniqueList(
    [
      ...input.synthesis.themes.flatMap((theme) => theme.channels),
      ...input.synthesis.opportunities.flatMap((opportunity) => opportunity.channels)
    ],
    6
  );
  const risksAndGuardrails = uniqueList(
    [
      ...input.synthesis.themes.flatMap((theme) => theme.risks),
      ...input.synthesis.opportunities.flatMap((opportunity) => opportunity.risks)
    ],
    4
  );

  const slide = SlideSchema.parse({
    slideTitle: `${input.synthesis.playground.name} playground plan`,
    subtitle: input.synthesis.executiveAnswer,
    keyTakeaways: keyTakeaways.length > 0 ? keyTakeaways : fallbackTakeaways.slice(0, 4),
    momentCallouts,
    activationAngles: activationAngles.slice(0, 5),
    recommendedChannels,
    risksAndGuardrails,
    speakerNotes: `Playground focus: ${input.synthesis.playground.definition}`,
    confidenceNote:
      input.planData.meta.wikiMatchesCount > 0
        ? "Signal confidence includes trends, reddit, and wikimedia validation."
        : "Signal confidence includes trends and reddit validation."
  });

  return { slide };
}
