"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type {
  AudienceInsightsNormalized,
  InsightsPayload,
  SearchInsightsNormalized
} from "@/lib/insights/types";
import {
  CATEGORIES,
  nowDate,
  parseCsvList,
  readJsonSafe,
  type BriefPayload,
  type UploadDebug,
  type UploadState
} from "@/app/hooks/cultureBotUtils";

type Options = {
  setError: Dispatch<SetStateAction<string | null>>;
};

export type BriefFormSlice = {
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
  selectedCategories: ("sports" | "film" | "holidays" | "events")[];
  briefPayload: BriefPayload;
  insightsPayload: InsightsPayload | undefined;
  audienceInsights: AudienceInsightsNormalized | null;
  setAudienceInsights: (insights: AudienceInsightsNormalized | null) => void;
  searchInsights: SearchInsightsNormalized | null;
  setSearchInsights: (insights: SearchInsightsNormalized | null) => void;
  audienceUpload: UploadState;
  setAudienceUpload: (state: UploadState) => void;
  searchUpload: UploadState;
  setSearchUpload: (state: UploadState) => void;
  uploadInsights: (type: "audience" | "search", file: File) => Promise<void>;
};

export function useBriefForm(_options: Options): BriefFormSlice {
  const [brand, setBrand] = useState("");
  const [objectivePreset, setObjectivePreset] = useState("Awareness");
  const [objectiveCustom, setObjectiveCustom] = useState("");
  const [audienceKeyword, setAudienceKeyword] = useState("");
  const [datePreset, setDatePreset] = useState<"4w" | "8w" | "custom">("4w");
  const [from, setFrom] = useState(nowDate(0));
  const [to, setTo] = useState(nowDate(28));
  const [boostKeywords, setBoostKeywords] = useState("");

  const [categoryState, setCategoryState] = useState<Record<string, boolean>>({
    sports: true,
    film: true,
    holidays: true,
    events: true
  });

  const [audienceInsights, setAudienceInsights] = useState<AudienceInsightsNormalized | null>(null);
  const [searchInsights, setSearchInsights] = useState<SearchInsightsNormalized | null>(null);
  const [audienceUpload, setAudienceUpload] = useState<UploadState>({ status: "NOT_UPLOADED" });
  const [searchUpload, setSearchUpload] = useState<UploadState>({ status: "NOT_UPLOADED" });

  const objective = objectivePreset === "Custom" ? objectiveCustom : objectivePreset;

  const selectedCategories = useMemo(
    () => CATEGORIES.filter((category) => categoryState[category]),
    [categoryState]
  );

  const insightsPayload = useMemo<InsightsPayload | undefined>(() => {
    if (!audienceInsights && !searchInsights) {
      return undefined;
    }
    return {
      audience: audienceInsights || undefined,
      search: searchInsights || undefined
    };
  }, [audienceInsights, searchInsights]);

  const briefPayload = useMemo<BriefPayload>(() => {
    return {
      brand: brand.trim() || undefined,
      objective: objective.trim() || undefined,
      audienceKeyword: audienceKeyword.trim(),
      from,
      to,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      boostKeywords: parseCsvList(boostKeywords)
    };
  }, [brand, objective, audienceKeyword, from, to, selectedCategories, boostKeywords]);

  // Date preset → from/to sync
  useEffect(() => {
    if (datePreset === "4w") {
      setFrom(nowDate(0));
      setTo(nowDate(28));
    } else if (datePreset === "8w") {
      setFrom(nowDate(0));
      setTo(nowDate(56));
    }
  }, [datePreset]);

  async function uploadInsights(type: "audience" | "search", file: File): Promise<void> {
    const endpoint = type === "audience" ? "/api/insights/audience" : "/api/insights/search";
    if (type === "audience") {
      setAudienceUpload({ status: "UPLOADING" });
    } else {
      setSearchUpload({ status: "UPLOADING" });
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });
      const json = await readJsonSafe<{
        ok?: boolean;
        insights?: AudienceInsightsNormalized | SearchInsightsNormalized;
        error?: string | { message?: string };
        debug?: UploadDebug;
      }>(response);

      if (!response.ok || !json?.ok || !json.insights) {
        const message =
          typeof json?.error === "string"
            ? json.error
            : json?.error && typeof json.error === "object" && "message" in json.error
              ? String((json.error as { message?: string }).message || "Upload failed")
              : "Upload failed";
        if (type === "audience") {
          setAudienceUpload({ status: "FAILED", error: message, debug: json?.debug || null });
        } else {
          setSearchUpload({ status: "FAILED", error: message, debug: json?.debug || null });
        }
        return;
      }

      if (type === "audience") {
        setAudienceInsights(json.insights as AudienceInsightsNormalized);
        setAudienceUpload({ status: "OK", debug: json.debug || null });
      } else {
        setSearchInsights(json.insights as SearchInsightsNormalized);
        setSearchUpload({ status: "OK", debug: json.debug || null });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      if (type === "audience") {
        setAudienceUpload({ status: "FAILED", error: message });
      } else {
        setSearchUpload({ status: "FAILED", error: message });
      }
    }
  }

  return {
    brand,
    setBrand,
    objectivePreset,
    setObjectivePreset,
    objectiveCustom,
    setObjectiveCustom,
    objective,
    audienceKeyword,
    setAudienceKeyword,
    datePreset,
    setDatePreset,
    from,
    setFrom,
    to,
    setTo,
    boostKeywords,
    setBoostKeywords,
    categoryState,
    setCategoryState,
    selectedCategories,
    briefPayload,
    insightsPayload,
    audienceInsights,
    setAudienceInsights,
    searchInsights,
    setSearchInsights,
    audienceUpload,
    setAudienceUpload,
    searchUpload,
    setSearchUpload,
    uploadInsights
  };
}
