"use client";

import { useMemo, useState } from "react";
import { dedupe, type CultureBotState } from "@/app/hooks/useCultureBot";
import PlaygroundCard, { PlaygroundCardSkeleton } from "@/app/components/PlaygroundCard";
import type { PlaygroundCandidate } from "@/lib/playground/types";

type Props = Pick<
  CultureBotState,
  | "brand"
  | "candidates"
  | "selectedPlaygroundId"
  | "playgroundWarnings"
  | "playgroundContext"
  | "insightsPayload"
  | "busyGeneratePlaygrounds"
  | "onSelectPlayground"
  | "setSelectedPlaygroundId"
  | "setStep"
  | "setProofOpen"
>;

type SortKey = "fit" | "demand" | "conv";
type AudienceFilter = "all" | "core" | "adjacent";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "fit",    label: "Fit"      },
  { key: "demand", label: "Demand"   },
  { key: "conv",   label: "Conversation" }
];

const SCORE_LEGEND = [
  { key: "fit",    label: "Fit",    source: "keyword & audience overlap",  color: "var(--c-accent)"  },
  { key: "demand", label: "Demand", source: "Google Trends rising queries", color: "var(--c-success)" },
  { key: "conv",   label: "Conv",   source: "Reddit posts & engagement",   color: "#7C3AED"          }
] as const;

function ScoreLegend() {
  return (
    <div className="pg-score-legend" aria-label="Score definitions">
      <span className="pg-legend-heading">Key</span>
      {SCORE_LEGEND.map(({ key, label, source, color }) => (
        <span key={key} className="pg-legend-item">
          <span className="pg-legend-dot" style={{ background: color }} aria-hidden="true" />
          <span className="pg-legend-name">{label}</span>
          <span className="pg-legend-dash" aria-hidden="true">—</span>
          <span className="pg-legend-source">{source}</span>
        </span>
      ))}
    </div>
  );
}

export default function PlaygroundPicker(props: Props) {
  const [sortBy, setSortBy]           = useState<SortKey>("fit");
  const [audienceFilter, setAudience] = useState<AudienceFilter>("all");

  const recommendedId = props.candidates[0]?.id ?? null;

  // Build source tags per candidate
  function getSourceTags(candidate: PlaygroundCandidate): string[] {
    const context = props.playgroundContext?.byPlaygroundId[candidate.id];
    return dedupe([
      ...(props.brand ? ["Brand"] : []),
      ...(props.insightsPayload ? ["CSV"] : []),
      ...(candidate.evidencePointers.some((p) => p.includes("googleTrends")) ? ["Trends"] : []),
      ...(candidate.evidencePointers.some((p) => p.includes("reddit")) ? ["Reddit"] : []),
      ...(context?.anchors?.length ? ["Perplexity"] : [])
    ], 5);
  }

  // Filter + sort
  const visible = useMemo(() => {
    let list = props.candidates.slice(0, 8);

    // Audience filter
    if (audienceFilter === "core") {
      list = list.filter((c) => c.audienceAlignment?.type !== "adjacent");
    } else if (audienceFilter === "adjacent") {
      list = list.filter((c) => c.audienceAlignment?.type === "adjacent");
    }

    // Sort (stable — preserve original rank for ties)
    const scoreKey: Record<SortKey, keyof typeof list[0]> = {
      fit:    "fitScore",
      demand: "demandScore",
      conv:   "conversationScore"
    };
    const key = scoreKey[sortBy];
    return [...list].sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [props.candidates, sortBy, audienceFilter]);

  // Counts for filter labels
  const coreCount     = props.candidates.filter((c) => c.audienceAlignment?.type !== "adjacent").length;
  const adjacentCount = props.candidates.filter((c) => c.audienceAlignment?.type === "adjacent").length;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (props.candidates.length === 0 && !props.busyGeneratePlaygrounds) {
    return (
      <div className="stack stack-5">
        <div>
          <h2 style={{ marginBottom: "var(--s2)" }}>Choose a playground</h2>
        </div>
        <div className="pg-empty">
          <div className="pg-empty-icon" aria-hidden="true">◎</div>
          <p className="pg-empty-title">No playgrounds found</p>
          <p className="pg-empty-body">
            Try broadening your brief — add boost keywords, widen the date range,
            or use a broader audience keyword.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => props.setStep("brief")}
          >
            ← Adjust brief
          </button>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (props.busyGeneratePlaygrounds && props.candidates.length === 0) {
    return (
      <div className="stack stack-5">
        <div>
          <h2 style={{ marginBottom: "var(--s2)" }}>Choose a playground</h2>
          <p className="small text-muted">Finding the best cultural territories…</p>
        </div>
        <div className="pg-grid">
          {[0, 1, 2, 4].map((i) => (
            <PlaygroundCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack stack-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ marginBottom: "var(--s2)" }}>Choose a playground</h2>
        <p className="small text-muted">
          {props.candidates.length} playground{props.candidates.length !== 1 ? "s" : ""} ranked
          by cultural fit{props.brand ? ` for ${props.brand}` : ""}.
          Select one to build your brief.
        </p>
      </div>

      {/* ── Warnings ────────────────────────────────────────────────────────── */}
      {props.playgroundWarnings.length > 0 ? (
        <div className="stack stack-2">
          {props.playgroundWarnings.map((w, i) => (
            <div className="banner banner-warning" key={`pg-warning-${i}`}>{w}</div>
          ))}
        </div>
      ) : null}

      {/* ── Toolbar: sort + filter ───────────────────────────────────────────── */}
      <div className="pg-toolbar" role="toolbar" aria-label="Sort and filter playgrounds">

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
          <span className="pg-toolbar-label">Sort</span>
          <div className="pg-sort-pills" role="group" aria-label="Sort by">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`pg-sort-pill${sortBy === key ? " is-active" : ""}`}
                onClick={() => setSortBy(key)}
                aria-pressed={sortBy === key}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Audience filter — only show if both types are present */}
        {adjacentCount > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
            <span className="pg-toolbar-label">Audience</span>
            <div className="pg-sort-pills" role="group" aria-label="Filter by audience">
              {([
                { key: "all",      label: `All (${props.candidates.length})` },
                { key: "core",     label: `Core (${coreCount})` },
                { key: "adjacent", label: `Adjacent (${adjacentCount})` }
              ] as { key: AudienceFilter; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`pg-sort-pill${audienceFilter === key ? " is-active" : ""}`}
                  onClick={() => setAudience(key)}
                  aria-pressed={audienceFilter === key}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Result count */}
        {visible.length !== props.candidates.length ? (
          <span className="small text-muted">
            Showing {visible.length} of {props.candidates.length}
          </span>
        ) : null}
      </div>

      {/* ── Score legend ────────────────────────────────────────────────────── */}
      <ScoreLegend />

      {/* ── No results after filter ──────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="pg-empty">
          <p className="pg-empty-title">No playgrounds match this filter</p>
          <button
            type="button"
            className="secondary btn-sm"
            onClick={() => setAudience("all")}
          >
            Clear filter
          </button>
        </div>
      ) : null}

      {/* ── Card grid ───────────────────────────────────────────────────────── */}
      <div className="pg-grid">
        {visible.map((candidate, i) => {
          // Compute original rank (position in unfiltered/sorted-by-fit list)
          const originalRank = props.candidates.indexOf(candidate) + 1;

          return (
            <PlaygroundCard
              key={candidate.id}
              candidate={candidate}
              rank={originalRank}
              isRecommended={candidate.id === recommendedId}
              context={props.playgroundContext?.byPlaygroundId[candidate.id]}
              sourceTags={getSourceTags(candidate)}
              onSelect={(c) => props.onSelectPlayground(c)}
              onViewProof={(id) => {
                props.setSelectedPlaygroundId(id);
                props.setProofOpen(true);
              }}
            />
          );
        })}
      </div>

    </div>
  );
}
