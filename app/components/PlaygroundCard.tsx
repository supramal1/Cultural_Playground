"use client";

import { useState } from "react";
import type { PlaygroundCandidate } from "@/lib/playground/types";
import type { PlaygroundContextResponse } from "@/lib/playground/perplexityContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaygroundCardProps = {
  candidate: PlaygroundCandidate;
  rank: number;
  isRecommended: boolean;
  context: PlaygroundContextResponse["byPlaygroundId"][string] | undefined;
  sourceTags: string[];
  onSelect: (candidate: PlaygroundCandidate) => void;
  onViewProof: (id: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   "var(--c-success)",
  medium: "#F59E0B",
  low:    "var(--c-danger)"
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   "High",
  medium: "Medium",
  low:    "Low"
};

function formatAge(hours: number): string {
  if (hours < 1)   return "< 1h ago";
  if (hours < 24)  return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function titleCase(v: string) {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function fmt(v: string) {
  return v.replace(/-/g, " ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBlock({
  value,
  label,
  colorClass
}: {
  value: number;
  label: string;
  colorClass: "fit" | "demand" | "conv";
}) {
  const qualLabel = value >= 67 ? "High" : value >= 34 ? "Med" : "Low";
  const titles: Record<string, string> = {
    fit:    "Fit — keyword & audience overlap",
    demand: "Demand — Google Trends rising queries",
    conv:   "Conv — Reddit posts & engagement"
  };

  return (
    <div
      className={`pg-stat pg-stat-${colorClass}`}
      title={`${titles[colorClass]}: ${value}/100 (${qualLabel})`}
    >
      <span className="pg-stat-value">{value}</span>
      <span className="pg-stat-label">{label}</span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className="pg-rank"
      aria-label={`Ranked #${rank}`}
      data-top={rank === 1 ? "true" : undefined}
    >
      {rank === 1 ? "★" : rank}
    </span>
  );
}

// ─── Main Card ────────────────────────────────────────────────────────────────

export default function PlaygroundCard({
  candidate,
  rank,
  isRecommended,
  context,
  sourceTags,
  onSelect,
  onViewProof
}: PlaygroundCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isAdjacent    = candidate.audienceAlignment?.type === "adjacent";
  const conf          = candidate.evidenceQa?.confidenceBand;
  const ageHours      = candidate.evidenceQa?.freshness.ageHours;
  const hook          = context?.validation ?? candidate.whyNow;
  const totalSignals  = candidate.evidenceQa?.sampleSize.totalSignals ?? 0;
  const baseline      = candidate.categoryBaseline;

  const alignAttr = isAdjacent ? "adjacent" : "core";

  return (
    <article
      className="pg-card"
      data-alignment={alignAttr}
      data-recommended={isRecommended && !isAdjacent ? "true" : undefined}
      data-rank={rank <= 3 ? String(rank) : undefined}
      aria-label={`Playground: ${candidate.name}, ranked #${rank}`}
    >
      {/* ── Card body ────────────────────────────────────────── */}
      <div className="pg-card-body">

        {/* Row 1: rank + name + chips */}
        <header className="pg-card-header">
          <RankBadge rank={rank} />
          <h3 className="pg-card-name">{candidate.name}</h3>
          <div className="pg-header-chips">
            {isRecommended && !isAdjacent ? (
              <span className="pg-chip pg-chip-rec">Top pick</span>
            ) : null}
            {isAdjacent ? (
              <span className="pg-chip pg-chip-adj">Adjacent</span>
            ) : null}
          </div>
        </header>

        {/* Row 2: hook (why now, 2-line clamp) */}
        <p className="pg-card-hook">{hook}</p>

        {/* Row 3: stat blocks */}
        <div className="pg-stats" role="group" aria-label="Scores">
          <StatBlock value={candidate.fitScore}          label="Fit"   colorClass="fit"    />
          <StatBlock value={candidate.demandScore}       label="Demand" colorClass="demand" />
          <StatBlock value={candidate.conversationScore} label="Conv"   colorClass="conv"   />
        </div>

        {/* Row 4: confidence + freshness + categories */}
        <div className="pg-meta">
          {conf ? (
            <span className="pg-confidence">
              <span
                className="confidence-dot"
                style={{ background: CONFIDENCE_COLOR[conf] ?? "var(--c-border-strong)" }}
                aria-hidden="true"
              />
              {CONFIDENCE_LABEL[conf] ?? titleCase(conf)} confidence
            </span>
          ) : null}

          {ageHours != null ? (
            <>
              <span className="pg-meta-sep" aria-hidden="true">·</span>
              <span className="pg-meta-item">{formatAge(ageHours)}</span>
            </>
          ) : null}

          {totalSignals > 0 ? (
            <>
              <span className="pg-meta-sep" aria-hidden="true">·</span>
              <span className="pg-meta-item">{totalSignals} signals</span>
            </>
          ) : null}

          {candidate.recommendedCategories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className={`category-badge category-${cat}`}
              style={{ marginLeft: "var(--s1)" }}
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Adjacent expansion note */}
        {isAdjacent && candidate.audienceAlignment?.note ? (
          <div className="banner adjacent">
            <strong>Expansion play.</strong>{" "}
            {candidate.audienceAlignment.note.slice(0, 130)}
            {candidate.audienceAlignment.note.length > 130 ? "…" : ""}
          </div>
        ) : null}

      </div>

      {/* ── Expand section ────────────────────────────────────── */}
      <div
        className={`pg-expand-wrap${expanded ? " is-open" : ""}`}
        id={`pg-expand-${candidate.id}`}
        aria-hidden={!expanded}
      >
        <div className="pg-expand-inner">
          <div className="pg-expand">

            {/* Definition */}
            <div>
              <span className="section-label" style={{ marginBottom: "var(--s2)" }}>What it is</span>
              <p className="small text-secondary" style={{ lineHeight: 1.55 }}>
                {candidate.definition}
              </p>
            </div>

            {/* Keywords */}
            {candidate.keywords.core.length > 0 ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Keywords</span>
                <div className="meta" style={{ marginTop: 0 }}>
                  {candidate.keywords.core.slice(0, 6).map((kw) => (
                    <span className="chip" key={kw} style={{ fontSize: "11px" }}>{kw}</span>
                  ))}
                  {candidate.keywords.core.length > 6 ? (
                    <span className="chip text-muted" style={{ fontSize: "11px" }}>
                      +{candidate.keywords.core.length - 6}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Source tags */}
            {sourceTags.length > 0 ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Data sources</span>
                <div className="meta" style={{ marginTop: 0 }}>
                  {sourceTags.map((tag) => (
                    <span className="chip" key={tag} style={{ fontSize: "11px" }}>{tag}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Baseline */}
            {baseline ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Category baseline</span>
                <div className="pg-expand-row-grid">
                  <div className="pg-expand-stat">
                    <span className="pg-expand-stat-label">Category</span>
                    <span className="pg-expand-stat-val">
                      {titleCase(baseline.primaryCategory)} · {titleCase(baseline.season)}
                    </span>
                  </div>
                  <div className="pg-expand-stat">
                    <span className="pg-expand-stat-label">Demand vs baseline</span>
                    <span className="pg-expand-stat-val">{fmt(baseline.demandLabel)}</span>
                  </div>
                  <div className="pg-expand-stat">
                    <span className="pg-expand-stat-label">Conv vs baseline</span>
                    <span className="pg-expand-stat-val">{fmt(baseline.conversationLabel)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Communities */}
            {candidate.communities.subreddits.length > 0 ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Communities</span>
                <p className="small text-secondary">
                  {candidate.communities.subreddits.slice(0, 4).join("  ·  ")}
                </p>
              </div>
            ) : null}

            {/* Risk flags */}
            {candidate.riskFlags.length > 0 ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)", color: "var(--c-warning)" }}>
                  Risk flags
                </span>
                <div className="meta" style={{ marginTop: 0 }}>
                  {candidate.riskFlags.slice(0, 3).map((flag) => (
                    <span
                      key={flag}
                      className="chip"
                      style={{
                        fontSize: "11px",
                        background: "var(--c-warning-bg)",
                        borderColor: "var(--c-warning-border)",
                        color: "var(--c-warning)"
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Anchors */}
            {context?.anchors?.length ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Sources</span>
                <div className="stack stack-2">
                  {context.anchors.slice(0, 3).map((anchor, i) => (
                    <a
                      key={i}
                      href={anchor.url}
                      target="_blank"
                      rel="noreferrer"
                      className="small"
                      style={{ display: "block" }}
                    >
                      {anchor.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Evidence QA detail */}
            {candidate.evidenceQa ? (
              <p className="small text-muted">
                {candidate.evidenceQa.sampleSize.trendsRisingQueries + candidate.evidenceQa.sampleSize.trendsRisingTopics} rising trends ·{" "}
                {candidate.evidenceQa.sampleSize.redditPosts} Reddit posts ·{" "}
                {candidate.evidenceQa.sampleSize.redditThemes} themes
              </p>
            ) : null}

            {/* Adjacency full note */}
            {isAdjacent && candidate.audienceAlignment?.note && candidate.audienceAlignment.note.length > 130 ? (
              <div>
                <span className="section-label" style={{ marginBottom: "var(--s2)" }}>Full adjacency note</span>
                <p className="small text-secondary">{candidate.audienceAlignment.note}</p>
              </div>
            ) : null}

          </div>
        </div>
      </div>

      {/* ── Card footer: actions ───────────────────────────────── */}
      <footer className="pg-card-footer">
        <button
          type="button"
          className="pg-select-btn"
          onClick={() => onSelect(candidate)}
        >
          Select playground
          <span className="pg-select-arrow" aria-hidden="true">→</span>
        </button>

        <button
          type="button"
          className="pg-ghost-btn"
          onClick={() => onViewProof(candidate.id)}
        >
          Proof
        </button>

        <button
          type="button"
          className="pg-expand-toggle"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-controls={`pg-expand-${candidate.id}`}
        >
          {expanded ? "Less" : "More"}
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              transition: "transform 0.2s ease",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              fontSize: "9px",
              marginLeft: "2px"
            }}
          >
            ▾
          </span>
        </button>
      </footer>
    </article>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

export function PlaygroundCardSkeleton() {
  return (
    <div className="pg-card pg-card-skeleton" aria-hidden="true">
      <div className="pg-card-body">
        <div className="pg-card-header">
          <div className="pg-skeleton-circle" />
          <div className="pg-skeleton-line" style={{ height: 20, width: "60%", flex: "0 0 60%" }} />
        </div>
        <div className="pg-skeleton-line" style={{ height: 13, width: "90%" }} />
        <div className="pg-skeleton-line" style={{ height: 13, width: "70%" }} />
        <div className="pg-stats">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pg-stat" style={{ minHeight: 52 }}>
              <div className="pg-skeleton-line" style={{ height: 20, width: 28 }} />
              <div className="pg-skeleton-line" style={{ height: 8, width: 24, marginTop: 4 }} />
            </div>
          ))}
        </div>
        <div className="pg-skeleton-line" style={{ height: 11, width: "50%" }} />
      </div>
      <div className="pg-card-footer" style={{ justifyContent: "flex-start", gap: "var(--s3)" }}>
        <div className="pg-skeleton-line" style={{ height: 30, width: 140, borderRadius: "var(--r-full)" }} />
        <div className="pg-skeleton-line" style={{ height: 30, width: 60, borderRadius: "var(--r-full)" }} />
      </div>
    </div>
  );
}
