"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { MAX_MOMENTS_TO_BUILD, MAX_OPPORTUNITY_CONTEXT_MOMENTS } from "@/lib/config";
import { signalScaleSummary } from "@/lib/signalScale";
import type { PlanData, PlaygroundCandidate } from "@/lib/playground/types";
import type { BrandSignals, BrandDiscourseContext } from "@/lib/brandSignals/types";
import type {
  PlaygroundContextResponse,
  OpportunityContextResponse
} from "@/lib/playground/perplexityContext";
import type { PlaygroundBlueprint, MediaOwnerBrief } from "@/lib/briefBuilder/types";
import type { Slide } from "@/lib/schemas/slide";
import type { InsightsPayload } from "@/lib/insights/types";
import {
  dedupe,
  downloadFile,
  csvFromMoments,
  toEmailBrief,
  toMarkdownBrief,
  readJsonSafe,
  apiErrorMessage,
  type BriefPayload,
  type Step
} from "@/app/hooks/cultureBotUtils";

type Options = {
  briefPayload: BriefPayload;
  insightsPayload: InsightsPayload | undefined;
  from: string;
  to: string;
  selectedPlayground: PlaygroundCandidate | null;
  candidates: PlaygroundCandidate[];
  selectedPlaygroundId: string | null;
  brandSignals: BrandSignals | null;
  brandDiscourseContext: BrandDiscourseContext | null;
  playgroundContext: PlaygroundContextResponse | null;
  setStep: (step: Step) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

export type BriefBuilderSlice = {
  blueprint: PlaygroundBlueprint | null;
  setBlueprint: (blueprint: PlaygroundBlueprint | null) => void;
  mediaBrief: MediaOwnerBrief | null;
  setMediaBrief: (brief: MediaOwnerBrief | null) => void;
  slide: Slide | null;
  planData: PlanData | null;
  setPlanData: (data: PlanData | null) => void;
  opportunityContext: OpportunityContextResponse | null;
  selectedMomentIds: string[];
  setSelectedMomentIds: (ids: string[]) => void;
  busyBuildBrief: boolean;
  busyMoments: boolean;
  onBuildBrief: () => Promise<void>;
  onLoadMoments: () => Promise<void>;
  toggleMoment: (momentId: string) => void;
  onRegenerateBlock: (mode: "regenerate" | "tighten" | "specific", block: string) => Promise<void>;
  onGenerateSlideJson: () => Promise<void>;
  copyEmailBrief: () => Promise<void>;
  copyMarkdownBrief: () => Promise<void>;
  downloadOpportunitiesCsv: () => void;
  downloadPdf: () => void;
};

export function useBriefBuilder({
  briefPayload,
  insightsPayload,
  from,
  to,
  selectedPlayground,
  candidates,
  selectedPlaygroundId,
  brandSignals,
  brandDiscourseContext,
  playgroundContext,
  setStep,
  setError,
  setNotice
}: Options): BriefBuilderSlice {
  const [blueprint, setBlueprint] = useState<PlaygroundBlueprint | null>(null);
  const [mediaBrief, setMediaBrief] = useState<MediaOwnerBrief | null>(null);
  const [slide, setSlide] = useState<Slide | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [opportunityContext, setOpportunityContext] = useState<OpportunityContextResponse | null>(null);
  const [selectedMomentIds, setSelectedMomentIds] = useState<string[]>([]);
  const [busyBuildBrief, setBusyBuildBrief] = useState(false);
  const [busyMoments, setBusyMoments] = useState(false);

  async function loadPlanDataForPlayground(playgroundId: string): Promise<{
    planData: PlanData;
    oppContext: OpportunityContextResponse | null;
  } | null> {
    const response = await fetch("/api/plan-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "v2",
        brief: briefPayload,
        chosenPlayground: { playgroundId },
        insights: insightsPayload,
        options: { refresh: true }
      })
    });

    const json = await readJsonSafe<{ ok?: boolean; planData?: PlanData; error?: string; details?: unknown }>(response);
    if (!response.ok || !json?.ok || !json.planData) {
      throw new Error(json?.error || "Moments load failed.");
    }

    const nextPlan = {
      ...json.planData,
      moments: json.planData.moments.slice(0, MAX_MOMENTS_TO_BUILD)
    };
    setPlanData(nextPlan);
    setNotice(`Loaded ${nextPlan.moments.length} moments. Fetching context from Perplexity...`);

    let oppContext: OpportunityContextResponse | null = null;
    try {
      const playgroundName = candidates.find((c) => c.id === playgroundId)?.name || playgroundId;
      const contextResponse = await fetch("/api/opportunity-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: briefPayload,
          playground: { id: playgroundId, name: playgroundName },
          topMoments: nextPlan.moments.slice(0, MAX_OPPORTUNITY_CONTEXT_MOMENTS)
        })
      });

      const contextJson = await readJsonSafe<{
        ok?: boolean;
        context?: OpportunityContextResponse;
        error?: string;
        details?: unknown;
      }>(contextResponse);

      if (contextResponse.ok && contextJson?.ok && contextJson.context) {
        oppContext = contextJson.context;
        setOpportunityContext(oppContext);
      } else {
        setNotice((prev) => [prev, "Opportunity context unavailable (Perplexity)."].filter(Boolean).join(" | "));
      }
    } catch {
      setNotice((prev) => [prev, "Opportunity context failed (non-blocking)."].filter(Boolean).join(" | "));
    }

    return { planData: nextPlan, oppContext };
  }

  async function generateBriefFromBlueprint(input: {
    candidate: PlaygroundCandidate;
    currentPlanData?: PlanData | null;
    currentOppContext?: OpportunityContextResponse | null;
    blueprintInstruction?: string;
    briefInstruction?: string;
  }): Promise<void> {
    setBusyBuildBrief(true);
    setError(null);
    setNotice(null);

    try {
      const activePlanData = input.currentPlanData || planData;
      const activeOppContext = input.currentOppContext || opportunityContext;

      setNotice("Generating blueprint from playground data...");
      const blueprintResponse = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v2",
          mode: "blueprint",
          brief: briefPayload,
          chosenPlayground: input.candidate,
          brandSignals: brandSignals || undefined,
          brandDiscourseContext: brandDiscourseContext || undefined,
          insights: insightsPayload,
          signals: activePlanData?.signals || undefined,
          playgroundContext: playgroundContext || undefined,
          instruction: input.blueprintInstruction
        })
      });

      const blueprintJson = await readJsonSafe<{
        blueprint?: PlaygroundBlueprint;
        meta?: { warnings?: string[] };
        error?: string;
        details?: unknown;
      }>(blueprintResponse);

      if (!blueprintResponse.ok || !blueprintJson?.blueprint) {
        throw new Error(apiErrorMessage(blueprintJson, "Blueprint generation failed."));
      }

      const nextBlueprint = blueprintJson.blueprint;
      setBlueprint(nextBlueprint);
      setNotice("Writing media owner brief...");

      const activeMomentIds = selectedMomentIds.length > 0
        ? selectedMomentIds
        : (activePlanData?.moments || []).slice(0, MAX_OPPORTUNITY_CONTEXT_MOMENTS).map((m) => m.id);
      const momentMap = new Map((activePlanData?.moments || []).map((m) => [m.id, m]));
      const selectedOpportunities = activeMomentIds
        .map((id) => momentMap.get(id))
        .filter(Boolean)
        .slice(0, MAX_MOMENTS_TO_BUILD) as PlanData["moments"];

      const scaleContext = signalScaleSummary({
        wikiEntities: activePlanData?.signals.wikimedia?.entities,
        trendsQueries: activePlanData?.signals.googleTrends?.topRelatedQueries,
        redditPosts: activePlanData?.signals.reddit?.topPosts,
        guardianArticles: activePlanData?.signals.guardian?.articles
      });

      const briefResponse = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v2",
          mode: "brief",
          brief: briefPayload,
          blueprint: nextBlueprint,
          selectedOpportunities,
          opportunityContext: activeOppContext || undefined,
          signalScaleContext: scaleContext.length > 0 ? scaleContext : undefined,
          instruction: input.briefInstruction
        })
      });

      const briefJson = await readJsonSafe<{
        brief?: MediaOwnerBrief;
        meta?: { warnings?: string[] };
        error?: string;
        details?: unknown;
      }>(briefResponse);

      if (!briefResponse.ok || !briefJson?.brief) {
        throw new Error(apiErrorMessage(briefJson, "Media owner brief generation failed."));
      }

      setMediaBrief(briefJson.brief);
      if (selectedMomentIds.length === 0 && activeMomentIds.length > 0) {
        setSelectedMomentIds(activeMomentIds);
      }
      setStep("builder");

      const warnings = [
        ...(blueprintJson.meta?.warnings || []),
        ...(briefJson.meta?.warnings || [])
      ];
      if (warnings.length) {
        setNotice(warnings.join(" | "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brief generation failed.");
    } finally {
      setBusyBuildBrief(false);
    }
  }

  async function onBuildBrief(): Promise<void> {
    if (!selectedPlayground) {
      setError("No playground selected.");
      return;
    }
    setBusyBuildBrief(true);
    setError(null);
    setNotice("Loading moments and signals...");

    try {
      const result = await loadPlanDataForPlayground(selectedPlayground.id);
      if (!result) {
        throw new Error("Failed to load plan data.");
      }
      setNotice("Generating brief...");
      await generateBriefFromBlueprint({
        candidate: selectedPlayground,
        currentPlanData: result.planData,
        currentOppContext: result.oppContext
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build brief.");
      setBusyBuildBrief(false);
    }
  }

  async function onLoadMoments(): Promise<void> {
    if (!selectedPlaygroundId) {
      setError("Select a playground first.");
      return;
    }

    setBusyMoments(true);
    setError(null);

    try {
      const result = await loadPlanDataForPlayground(selectedPlaygroundId);
      if (!result) {
        throw new Error("Failed to load plan data.");
      }
      setNotice("Top 8 opportunities loaded. Add relevant moments into the brief.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load moments.");
    } finally {
      setBusyMoments(false);
    }
  }

  function toggleMoment(momentId: string): void {
    const next = selectedMomentIds.includes(momentId)
      ? selectedMomentIds.filter((id) => id !== momentId)
      : dedupe([...selectedMomentIds, momentId], MAX_MOMENTS_TO_BUILD);
    setSelectedMomentIds(next);

    if (!mediaBrief || !planData) {
      return;
    }

    const byId = new Map(planData.moments.map((moment) => [moment.id, moment]));
    const existingBriefMoments = new Map(
      (mediaBrief.momentsToBuildAround || []).map((m) => [m.momentId, m])
    );

    const momentsToBuildAround = next
      .map((id) => {
        if (existingBriefMoments.has(id)) return existingBriefMoments.get(id)!;

        const moment = byId.get(id);
        if (!moment) return null;
        const opportunity = opportunityContext?.byMomentId[id];
        return {
          momentId: id,
          culturalBehaviour: `Cultural behaviour around ${moment.title}`,
          audienceState: "Engaged and receptive to contextually relevant content",
          actionBullets: opportunity?.whyNowBullets?.slice(0, 2) || ["Build a relevant activation around this moment."],
          evidencePointers:
            moment.evidencePointers.slice(0, 2).length > 0
              ? moment.evidencePointers.slice(0, 2)
              : opportunity?.evidencePointers.slice(0, 2) || []
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    setMediaBrief({
      ...mediaBrief,
      momentsToBuildAround
    });
  }

  async function onRegenerateBlock(mode: "regenerate" | "tighten" | "specific", block: string): Promise<void> {
    if (!selectedPlayground || !blueprint) {
      return;
    }

    const instruction =
      mode === "regenerate"
        ? `Regenerate the ${block} section.`
        : mode === "tighten"
          ? `Tighten language for ${block}.`
          : `Make ${block} specific to brand and audience.`;

    await generateBriefFromBlueprint({
      candidate: selectedPlayground,
      briefInstruction: instruction
    });
  }

  async function onGenerateSlideJson(): Promise<void> {
    if (!mediaBrief) {
      return;
    }

    setError(null);
    try {
      const response = await fetch("/api/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "v2",
          mediaOwnerBrief: mediaBrief,
          playgroundName: selectedPlayground?.name,
          from,
          to
        })
      });

      const json = await readJsonSafe<{ slide?: Slide; error?: string; details?: unknown }>(response);
      if (!response.ok || !json?.slide) {
        throw new Error(json?.error || "Slide generation failed.");
      }
      setSlide(json.slide);
      setNotice("Slide JSON generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slide generation failed.");
    }
  }

  async function copyEmailBrief(): Promise<void> {
    if (!mediaBrief) return;
    await navigator.clipboard.writeText(
      toEmailBrief({
        brief: mediaBrief,
        blueprint,
        planData,
        opportunityContext,
        selectedMomentIds,
        from,
        to
      })
    );
    setNotice("Email brief copied.");
  }

  async function copyMarkdownBrief(): Promise<void> {
    if (!mediaBrief) return;
    await navigator.clipboard.writeText(
      toMarkdownBrief({
        brief: mediaBrief,
        blueprint,
        planData,
        opportunityContext,
        selectedMomentIds,
        from,
        to
      })
    );
    setNotice("Markdown brief copied.");
  }

  function downloadOpportunitiesCsv(): void {
    if (!planData) return;
    downloadFile("culture-bot-opportunities.csv", csvFromMoments(planData.moments), "text/csv;charset=utf-8;");
  }

  function downloadPdf(): void {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return {
    blueprint,
    setBlueprint,
    mediaBrief,
    setMediaBrief,
    slide,
    planData,
    setPlanData,
    opportunityContext,
    selectedMomentIds,
    setSelectedMomentIds,
    busyBuildBrief,
    busyMoments,
    onBuildBrief,
    onLoadMoments,
    toggleMoment,
    onRegenerateBlock,
    onGenerateSlideJson,
    copyEmailBrief,
    copyMarkdownBrief,
    downloadOpportunitiesCsv,
    downloadPdf
  };
}
