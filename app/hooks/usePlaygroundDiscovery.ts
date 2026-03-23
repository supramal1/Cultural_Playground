"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { PlaygroundCandidate } from "@/lib/playground/types";
import type { BrandSignals, BrandDiscourseContext } from "@/lib/brandSignals/types";
import type { PlaygroundContextResponse } from "@/lib/playground/perplexityContext";
import type { InsightsPayload } from "@/lib/insights/types";
import {
  parseCsvList,
  readJsonSafe,
  type BriefPayload,
  type PlaygroundMeta,
  type Step
} from "@/app/hooks/cultureBotUtils";

type Options = {
  briefPayload: BriefPayload;
  insightsPayload: InsightsPayload | undefined;
  boostKeywords: string;
  setStep: (step: Step) => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
};

export type PlaygroundDiscoverySlice = {
  candidates: PlaygroundCandidate[];
  setCandidates: (candidates: PlaygroundCandidate[]) => void;
  selectedPlaygroundId: string | null;
  setSelectedPlaygroundId: (id: string | null) => void;
  selectedPlayground: PlaygroundCandidate | null;
  playgroundMeta: PlaygroundMeta | null;
  playgroundWarnings: string[];
  playgroundContext: PlaygroundContextResponse | null;
  brandSignals: BrandSignals | null;
  brandDiscourseContext: BrandDiscourseContext | null;
  busyGeneratePlaygrounds: boolean;
  onGeneratePlaygrounds: (skipDiscoverySignals: boolean) => Promise<void>;
  onSelectPlayground: (candidate: PlaygroundCandidate) => void;
};

export function usePlaygroundDiscovery({
  briefPayload,
  insightsPayload,
  boostKeywords,
  setStep,
  setError,
  setNotice
}: Options): PlaygroundDiscoverySlice {
  const [candidates, setCandidates] = useState<PlaygroundCandidate[]>([]);
  const [selectedPlaygroundId, setSelectedPlaygroundId] = useState<string | null>(null);
  const [playgroundMeta, setPlaygroundMeta] = useState<PlaygroundMeta | null>(null);
  const [playgroundWarnings, setPlaygroundWarnings] = useState<string[]>([]);
  const [brandSignals, setBrandSignals] = useState<BrandSignals | null>(null);
  const [brandDiscourseContext, setBrandDiscourseContext] = useState<BrandDiscourseContext | null>(null);
  const [playgroundContext, setPlaygroundContext] = useState<PlaygroundContextResponse | null>(null);
  const [busyGeneratePlaygrounds, setBusyGeneratePlaygrounds] = useState(false);

  const selectedPlayground = useMemo(() => {
    if (!selectedPlaygroundId) {
      return null;
    }
    return candidates.find((item) => item.id === selectedPlaygroundId) || null;
  }, [candidates, selectedPlaygroundId]);

  async function onGeneratePlaygrounds(skipDiscoverySignals: boolean): Promise<void> {
    setError(null);
    setNotice(null);
    setBusyGeneratePlaygrounds(true);

    try {
      if (!briefPayload.audienceKeyword.trim()) {
        throw new Error("Audience is required.");
      }

      const [playgroundResponse, brandResponse] = await Promise.all([
        fetch("/api/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: "v2",
            brief: briefPayload,
            insights: insightsPayload,
            options: {
              maxCandidates: 8,
              skipDiscoverySignals,
              includePerplexity: true
            }
          })
        }),
        fetch("/api/brand-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: "v2",
            brief: briefPayload,
            keywordSet: {
              core: parseCsvList(boostKeywords).slice(0, 12)
            },
            options: {
              includePerplexity: true
            }
          })
        })
      ]);

      const playgroundJson = await readJsonSafe<{
        ok?: boolean;
        candidates?: PlaygroundCandidate[];
        meta?: PlaygroundMeta;
        error?: string;
        details?: unknown;
      }>(playgroundResponse);

      if (!playgroundResponse.ok || !playgroundJson?.ok || !playgroundJson.candidates) {
        throw new Error(playgroundJson?.error || "Playground discovery failed.");
      }

      const topCandidates = playgroundJson.candidates.slice(0, 8);
      setCandidates(topCandidates);
      setSelectedPlaygroundId(topCandidates[0]?.id || null);
      setPlaygroundMeta(playgroundJson.meta || null);
      setPlaygroundWarnings(playgroundJson.meta?.warnings || []);
      setStep("playground");

      const brandJson = await readJsonSafe<{
        ok?: boolean;
        brandSignals?: BrandSignals;
        brandDiscourseContext?: BrandDiscourseContext;
        meta?: { warnings?: string[]; skipped?: boolean };
        error?: string;
        details?: unknown;
      }>(brandResponse);

      if (brandResponse.ok && brandJson?.ok) {
        setBrandSignals(brandJson.brandSignals || null);
        setBrandDiscourseContext(brandJson.brandDiscourseContext || null);
        if (brandJson.meta?.warnings?.length) {
          setNotice(brandJson.meta.warnings.join(" | "));
        }
      }

      fetch("/api/playground-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: briefPayload,
          candidates: topCandidates
        })
      })
        .then(async (response) => {
          const json = await readJsonSafe<{
            ok?: boolean;
            context?: PlaygroundContextResponse;
            meta?: { cache?: string };
            error?: string;
            details?: unknown;
          }>(response);
          if (response.ok && json?.ok && json.context) {
            setPlaygroundContext(json.context);
          } else {
            setNotice((prev) => [prev, "Playground context unavailable (Perplexity skipped or failed)."].filter(Boolean).join(" | "));
          }
        })
        .catch(() => {
          setNotice((prev) => [prev, "Playground context failed (non-blocking)."].filter(Boolean).join(" | "));
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate playgrounds.");
    } finally {
      setBusyGeneratePlaygrounds(false);
    }
  }

  function onSelectPlayground(candidate: PlaygroundCandidate): void {
    setSelectedPlaygroundId(candidate.id);
    setStep("audience");
  }

  return {
    candidates,
    setCandidates,
    selectedPlaygroundId,
    setSelectedPlaygroundId,
    selectedPlayground,
    playgroundMeta,
    playgroundWarnings,
    playgroundContext,
    brandSignals,
    brandDiscourseContext,
    busyGeneratePlaygrounds,
    onGeneratePlaygrounds,
    onSelectPlayground
  };
}
