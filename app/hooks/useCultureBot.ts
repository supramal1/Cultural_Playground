"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AudienceInsightsNormalized,
  InsightsPayload,
  SearchInsightsNormalized
} from "@/lib/insights/types";
import type { PlanData, PlaygroundCandidate } from "@/lib/playground/types";
import type { BrandDiscourseContext, BrandSignals } from "@/lib/brandSignals/types";
import type {
  PlaygroundContextResponse,
  OpportunityContextResponse
} from "@/lib/playground/perplexityContext";
import type { PlaygroundBlueprint, MediaOwnerBrief } from "@/lib/briefBuilder/types";
import type { Slide } from "@/lib/schemas/slide";

import {
  CATEGORIES,
  INSIGHTS_STORAGE_KEY,
  SNAPSHOT_STORAGE_KEY,
  parseCsvList,
  dedupe,
  nowDate,
  formatDate,
  formatDateTime,
  pointerLabel,
  readPath,
  downloadFile,
  csvFromMoments,
  toEmailBrief,
  toMarkdownBrief,
  type Step,
  type UploadDebug,
  type UploadState,
  type PlaygroundMeta
} from "@/app/hooks/cultureBotUtils";

import { useBriefForm } from "@/app/hooks/useBriefForm";
import { usePlaygroundDiscovery } from "@/app/hooks/usePlaygroundDiscovery";
import { useBriefBuilder } from "@/app/hooks/useBriefBuilder";

// Re-export for backward compat with existing component imports
export { CATEGORIES, dedupe, formatDate, formatDateTime, pointerLabel, parseCsvList, nowDate, downloadFile, csvFromMoments, toEmailBrief, toMarkdownBrief };
export type { Step, UploadDebug, UploadState, PlaygroundMeta };

export type CultureBotState = {
  step: Step;
  setStep: (step: Step) => void;

  brand: string;
  setBrand: (value: string) => void;
  objectivePreset: string;
  setObjectivePreset: (value: string) => void;
  objectiveCustom: string;
  setObjectiveCustom: (value: string) => void;
  objective: string;
  audienceKeyword: string;
  setAudienceKeyword: (value: string) => void;
  datePreset: "4w" | "8w" | "custom";
  setDatePreset: (value: "4w" | "8w" | "custom") => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  boostKeywords: string;
  setBoostKeywords: (value: string) => void;
  categoryState: Record<string, boolean>;
  setCategoryState: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;

  audienceUpload: UploadState;
  searchUpload: UploadState;

  candidates: PlaygroundCandidate[];
  selectedPlaygroundId: string | null;
  setSelectedPlaygroundId: (id: string | null) => void;
  selectedPlayground: PlaygroundCandidate | null;
  playgroundMeta: PlaygroundMeta | null;
  playgroundWarnings: string[];
  playgroundContext: PlaygroundContextResponse | null;

  brandSignals: BrandSignals | null;
  brandDiscourseContext: BrandDiscourseContext | null;

  blueprint: PlaygroundBlueprint | null;
  mediaBrief: MediaOwnerBrief | null;
  setMediaBrief: (brief: MediaOwnerBrief | null) => void;
  slide: Slide | null;

  planData: PlanData | null;
  opportunityContext: OpportunityContextResponse | null;
  selectedMomentIds: string[];

  proofOpen: boolean;
  setProofOpen: (updater: boolean | ((prev: boolean) => boolean)) => void;
  selectedPointer: string | null;
  setSelectedPointer: (pointer: string | null) => void;

  busyGeneratePlaygrounds: boolean;
  busyBuildBrief: boolean;
  busyMoments: boolean;
  isBusy: boolean;

  error: string | null;
  notice: string | null;

  insightsPayload: InsightsPayload | undefined;
  audienceInsights: AudienceInsightsNormalized | null;
  searchInsights: SearchInsightsNormalized | null;

  pointerRoot: Record<string, unknown>;
  pointerValue: unknown;

  uploadInsights: (type: "audience" | "search", file: File) => Promise<void>;
  onGeneratePlaygrounds: (skipDiscoverySignals: boolean) => Promise<void>;
  onSelectPlayground: (candidate: PlaygroundCandidate) => void;
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

export function useCultureBot(): CultureBotState {
  const [step, setStep] = useState<Step>("brief");
  const [proofOpen, setProofOpen] = useState(false);
  const [selectedPointer, setSelectedPointer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useBriefForm({ setError });

  const discovery = usePlaygroundDiscovery({
    briefPayload: form.briefPayload,
    insightsPayload: form.insightsPayload,
    boostKeywords: form.boostKeywords,
    setStep,
    setError,
    setNotice
  });

  const builder = useBriefBuilder({
    briefPayload: form.briefPayload,
    insightsPayload: form.insightsPayload,
    from: form.from,
    to: form.to,
    selectedPlayground: discovery.selectedPlayground,
    candidates: discovery.candidates,
    selectedPlaygroundId: discovery.selectedPlaygroundId,
    brandSignals: discovery.brandSignals,
    brandDiscourseContext: discovery.brandDiscourseContext,
    playgroundContext: discovery.playgroundContext,
    setStep,
    setError,
    setNotice
  });

  const isBusy = discovery.busyGeneratePlaygrounds || builder.busyBuildBrief || builder.busyMoments;

  // URL params hydration — runs once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get("step");
    if (stepParam === "brief" || stepParam === "playground" || stepParam === "audience" || stepParam === "builder" || stepParam === "proof") {
      setStep(stepParam);
    }
    form.setBrand(params.get("brand") || "");
    form.setAudienceKeyword(params.get("audience") || "");
    form.setFrom(params.get("from") || nowDate(0));
    form.setTo(params.get("to") || nowDate(28));
    form.setBoostKeywords(params.get("boost") || "");
    const objectiveParam = params.get("objective") || "Awareness";
    const validPresets = ["Awareness", "Consideration", "Conversion", "Custom"];
    if (validPresets.includes(objectiveParam)) {
      form.setObjectivePreset(objectiveParam);
    } else {
      form.setObjectivePreset("Custom");
      form.setObjectiveCustom(objectiveParam);
    }

    const categoriesParam = params.get("categories");
    if (categoriesParam) {
      const selected = categoriesParam.split(",").map((item) => item.trim()).filter(Boolean);
      form.setCategoryState(() => ({
        sports: selected.includes("sports"),
        film: selected.includes("film"),
        holidays: selected.includes("holidays"),
        events: selected.includes("events")
      }));
    }

    const playgroundId = params.get("playgroundId");
    if (playgroundId) {
      discovery.setSelectedPlaygroundId(playgroundId);
    }

    // Restore insights from localStorage
    const savedInsightsRaw = localStorage.getItem(INSIGHTS_STORAGE_KEY);
    if (savedInsightsRaw) {
      try {
        const parsed = JSON.parse(savedInsightsRaw) as InsightsPayload;
        if (parsed.audience) {
          form.setAudienceInsights(parsed.audience);
          form.setAudienceUpload({ status: "OK" });
        }
        if (parsed.search) {
          form.setSearchInsights(parsed.search);
          form.setSearchUpload({ status: "OK" });
        }
      } catch {
        // ignore invalid insight snapshot
      }
    }

    // Restore session snapshot from localStorage
    const snapshotRaw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (snapshotRaw) {
      try {
        const parsed = JSON.parse(snapshotRaw) as {
          candidates?: PlaygroundCandidate[];
          selectedPlaygroundId?: string;
          blueprint?: PlaygroundBlueprint;
          mediaBrief?: MediaOwnerBrief;
          planData?: PlanData;
          selectedMomentIds?: string[];
        };
        if (parsed.candidates?.length) {
          discovery.setCandidates(parsed.candidates);
        }
        if (parsed.selectedPlaygroundId) {
          discovery.setSelectedPlaygroundId(parsed.selectedPlaygroundId);
        }
        if (parsed.blueprint) {
          builder.setBlueprint(parsed.blueprint);
        }
        if (parsed.mediaBrief) {
          builder.setMediaBrief(parsed.mediaBrief);
        }
        if (parsed.planData) {
          builder.setPlanData(parsed.planData);
        }
        if (parsed.selectedMomentIds) {
          builder.setSelectedMomentIds(parsed.selectedMomentIds);
        }
      } catch {
        // ignore invalid snapshot
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("step", step);
    if (form.brand.trim()) params.set("brand", form.brand.trim());
    if (form.objective.trim()) params.set("objective", form.objective.trim());
    if (form.audienceKeyword.trim()) params.set("audience", form.audienceKeyword.trim());
    params.set("from", form.from);
    params.set("to", form.to);
    if (form.boostKeywords.trim()) params.set("boost", form.boostKeywords.trim());
    if (form.selectedCategories.length) params.set("categories", form.selectedCategories.join(","));
    if (discovery.selectedPlaygroundId) params.set("playgroundId", discovery.selectedPlaygroundId);

    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [step, form.brand, form.objective, form.audienceKeyword, form.from, form.to, form.boostKeywords, form.selectedCategories, discovery.selectedPlaygroundId]);

  // Insights persistence
  useEffect(() => {
    const payload: InsightsPayload = {
      audience: form.audienceInsights || undefined,
      search: form.searchInsights || undefined
    };
    if (payload.audience || payload.search) {
      localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(INSIGHTS_STORAGE_KEY);
    }
  }, [form.audienceInsights, form.searchInsights]);

  // Snapshot persistence
  useEffect(() => {
    localStorage.setItem(
      SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        candidates: discovery.candidates,
        selectedPlaygroundId: discovery.selectedPlaygroundId,
        blueprint: builder.blueprint,
        mediaBrief: builder.mediaBrief,
        planData: builder.planData,
        selectedMomentIds: builder.selectedMomentIds
      })
    );
  }, [discovery.candidates, discovery.selectedPlaygroundId, builder.blueprint, builder.mediaBrief, builder.planData, builder.selectedMomentIds]);

  const pointerRoot = useMemo(() => {
    return {
      brandSignals: discovery.brandSignals,
      brandDiscourseContext: discovery.brandDiscourseContext,
      insights: form.insightsPayload,
      playgroundContext: discovery.playgroundContext,
      opportunityContext: builder.opportunityContext,
      planData: builder.planData
    };
  }, [discovery.brandSignals, discovery.brandDiscourseContext, form.insightsPayload, discovery.playgroundContext, builder.opportunityContext, builder.planData]);

  const pointerValue = useMemo(() => {
    if (!selectedPointer) {
      return null;
    }

    const [root, ...rest] = selectedPointer.split(".");
    const source = (pointerRoot as Record<string, unknown>)[root];
    return readPath(source, rest.join("."));
  }, [selectedPointer, pointerRoot]);

  return {
    step,
    setStep,
    brand: form.brand,
    setBrand: form.setBrand,
    objectivePreset: form.objectivePreset,
    setObjectivePreset: form.setObjectivePreset,
    objectiveCustom: form.objectiveCustom,
    setObjectiveCustom: form.setObjectiveCustom,
    objective: form.objective,
    audienceKeyword: form.audienceKeyword,
    setAudienceKeyword: form.setAudienceKeyword,
    datePreset: form.datePreset,
    setDatePreset: form.setDatePreset,
    from: form.from,
    setFrom: form.setFrom,
    to: form.to,
    setTo: form.setTo,
    boostKeywords: form.boostKeywords,
    setBoostKeywords: form.setBoostKeywords,
    categoryState: form.categoryState,
    setCategoryState: form.setCategoryState,
    audienceUpload: form.audienceUpload,
    searchUpload: form.searchUpload,
    candidates: discovery.candidates,
    selectedPlaygroundId: discovery.selectedPlaygroundId,
    setSelectedPlaygroundId: discovery.setSelectedPlaygroundId,
    selectedPlayground: discovery.selectedPlayground,
    playgroundMeta: discovery.playgroundMeta,
    playgroundWarnings: discovery.playgroundWarnings,
    playgroundContext: discovery.playgroundContext,
    brandSignals: discovery.brandSignals,
    brandDiscourseContext: discovery.brandDiscourseContext,
    blueprint: builder.blueprint,
    mediaBrief: builder.mediaBrief,
    setMediaBrief: builder.setMediaBrief,
    slide: builder.slide,
    planData: builder.planData,
    opportunityContext: builder.opportunityContext,
    selectedMomentIds: builder.selectedMomentIds,
    proofOpen,
    setProofOpen,
    selectedPointer,
    setSelectedPointer,
    busyGeneratePlaygrounds: discovery.busyGeneratePlaygrounds,
    busyBuildBrief: builder.busyBuildBrief,
    busyMoments: builder.busyMoments,
    isBusy,
    error,
    notice,
    insightsPayload: form.insightsPayload,
    audienceInsights: form.audienceInsights,
    searchInsights: form.searchInsights,
    pointerRoot,
    pointerValue,
    uploadInsights: form.uploadInsights,
    onGeneratePlaygrounds: discovery.onGeneratePlaygrounds,
    onSelectPlayground: discovery.onSelectPlayground,
    onBuildBrief: builder.onBuildBrief,
    onLoadMoments: builder.onLoadMoments,
    toggleMoment: builder.toggleMoment,
    onRegenerateBlock: builder.onRegenerateBlock,
    onGenerateSlideJson: builder.onGenerateSlideJson,
    copyEmailBrief: builder.copyEmailBrief,
    copyMarkdownBrief: builder.copyMarkdownBrief,
    downloadOpportunitiesCsv: builder.downloadOpportunitiesCsv,
    downloadPdf: builder.downloadPdf
  };
}
