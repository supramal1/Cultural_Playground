"use client";

import { useState } from "react";
import type { PlaygroundCandidate } from "@/lib/playground/types";
import type { Step } from "@/app/hooks/useCultureBot";
import type { AudienceInsightsNormalized } from "@/lib/insights/types";
import { AUDIENCE_PROFILES, type MediaOwnerRecommendation } from "@/lib/playground/audienceProfiles";

type Props = {
  selectedPlayground: PlaygroundCandidate | null;
  audienceKeyword: string;
  audienceInsights: AudienceInsightsNormalized | null;
  busyBuildBrief: boolean;
  onBuildBrief: () => Promise<void>;
  setStep: (step: Step) => void;
};

const PLATFORM_COLOR: Record<string, string> = {
  Meta:         "#1877F2",
  Google:       "#4285F4",
  TikTok:       "#000000",
  Programmatic: "#7C3AED"
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlannerNote({ note }: { note: string }) {
  return (
    <div className="aud-planner-note" role="note">
      <div className="aud-planner-note-icon" aria-hidden="true">↗</div>
      <div>
        <span className="aud-planner-note-label">Planner insight</span>
        <p className="aud-planner-note-body">{note}</p>
      </div>
    </div>
  );
}

function RealDataPanel({ insights }: { insights: AudienceInsightsNormalized }) {
  const topAffinities = (insights.topAffinities ?? [])
    .filter((a) => a.index != null && a.index > 100)
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0))
    .slice(0, 6);

  if (topAffinities.length === 0) return null;

  const maxIndex = Math.max(...topAffinities.map((a) => a.index ?? 0), 200);

  return (
    <section className="card">
      <div className="aud-real-data-header">
        <div>
          <span className="section-label">Uploaded audience insights</span>
          {insights.meta.timeFrame ? (
            <span className="small text-muted" style={{ marginLeft: "var(--s3)" }}>
              {insights.meta.timeFrame}
            </span>
          ) : null}
        </div>
        {insights.meta.location ? (
          <span className="chip" style={{ fontSize: "11px" }}>{insights.meta.location}</span>
        ) : null}
      </div>
      <p className="small text-muted" style={{ marginBottom: "var(--s4)", marginTop: "var(--s1)" }}>
        Top affinities by index vs.{" "}
        <strong>{insights.meta.baselineAudience ?? "baseline"}</strong>.
        Index &gt; 100 = over-indexed.
      </p>
      <div className="aud-affinity-list" role="list">
        {topAffinities.map((row, i) => (
          <div key={i} className="aud-affinity-row" role="listitem">
            <div className="aud-affinity-meta">
              <span className="aud-affinity-item">{row.item}</span>
              <span className="aud-affinity-area">{row.area} · {row.subArea}</span>
            </div>
            <div className="aud-affinity-bar-wrap">
              <div
                className="aud-affinity-bar"
                style={{ width: `${Math.round(((row.index ?? 0) / maxIndex) * 100)}%` }}
                role="meter"
                aria-valuenow={row.index ?? 0}
                aria-label={`Index: ${row.index}`}
              />
            </div>
            <span className="aud-affinity-index-label" title="Affinity index vs baseline">
              {row.index}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MediaOwnersSection({ owners }: { owners: MediaOwnerRecommendation[] }) {
  return (
    <section>
      <div style={{ marginBottom: "var(--s4)" }}>
        <span className="section-label">Where to reach them</span>
        <p className="small text-muted" style={{ marginTop: "var(--s1)" }}>
          Recommended media owners — ranked by playground fit.{" "}
          <span style={{ opacity: 0.6 }}>[Synthetic demo data]</span>
        </p>
      </div>
      <div className="aud-media-owners">
        {owners.map((mo, i) => (
          <div key={mo.name} className="aud-owner-row">
            <div className="aud-owner-rank" aria-label={`Priority ${i + 1}`}>{i + 1}</div>
            <div className="aud-owner-body">
              <strong className="aud-owner-name">{mo.name}</strong>
              <p className="small text-secondary" style={{ marginTop: "2px", marginBottom: "var(--s2)" }}>
                {mo.rationale}
              </p>
              <div className="meta" style={{ marginTop: 0 }}>
                {mo.formats.slice(0, 4).map((f) => (
                  <span className="chip" key={f} style={{ fontSize: "11px" }}>{f}</span>
                ))}
                {mo.formats.length > 4 ? (
                  <span className="chip text-muted" style={{ fontSize: "11px" }}>
                    +{mo.formats.length - 4}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CulturalSignalsSection({
  watching, listening, events, platforms
}: {
  watching: string[]; listening: string[]; events: string[]; platforms: string[];
}) {
  const blocks = [
    { heading: "Platforms", items: platforms, type: "chips" as const },
    { heading: "Events & experiences", items: events, type: "list" as const },
    { heading: "Watching", items: watching, type: "list" as const },
    { heading: "Listening", items: listening, type: "list" as const }
  ].filter((b) => b.items.length > 0);

  if (blocks.length === 0) return null;

  return (
    <section className="card">
      <span className="section-label" style={{ display: "block", marginBottom: "var(--s4)" }}>
        What they care about
      </span>
      <div className="aud-signals-grid">
        {blocks.map((block) => (
          <div key={block.heading} className="aud-signal-block">
            <h4 className="aud-signal-heading">{block.heading}</h4>
            {block.type === "chips" ? (
              <div className="meta" style={{ marginTop: "var(--s2)" }}>
                {block.items.map((p) => (
                  <span className="chip" key={p} style={{ fontSize: "11px" }}>{p}</span>
                ))}
              </div>
            ) : (
              <ul className="aud-signal-list">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Accordion({
  label, open, onToggle, children
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <button
        type="button"
        className="aud-accordion-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="section-label">{label}</span>
        <span
          className="aud-accordion-chevron"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>
      <div
        className={`aud-accordion-body${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="aud-accordion-inner">{children}</div>
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AudienceStep(props: Props) {
  const [targetingOpen, setTargetingOpen] = useState(false);
  const [demoOpen, setDemoOpen]           = useState(false);

  // ── No playground ─────────────────────────────────────────────────────────
  if (!props.selectedPlayground) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: "var(--s3)" }}>Audience profile</h2>
        <p className="small text-muted">Select a playground first to see its audience profile.</p>
        <div className="actions" style={{ marginTop: "var(--s4)" }}>
          <button type="button" className="secondary" onClick={() => props.setStep("playground")}>
            ← Back to playgrounds
          </button>
        </div>
      </div>
    );
  }

  const profile        = AUDIENCE_PROFILES[props.selectedPlayground.id];
  const playgroundName = props.selectedPlayground.name;
  const isAdjacent     = props.selectedPlayground.audienceAlignment?.type === "adjacent";
  const hasRealData    = (props.audienceInsights?.topAffinities?.length ?? 0) > 0;

  // ── No profile ────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="stack stack-4">
        <div className="card">
          <h2 style={{ marginBottom: "var(--s2)" }}>Audience profile</h2>
          <p className="small text-muted">
            No audience profile available for <strong>{playgroundName}</strong>.
          </p>
          <div className="actions" style={{ marginTop: "var(--s4)" }}>
            <button
              type="button"
              disabled={props.busyBuildBrief}
              onClick={() => void props.onBuildBrief()}
            >
              {props.busyBuildBrief ? "Building brief…" : "Continue to brief builder →"}
            </button>
            <button type="button" className="secondary" onClick={() => props.setStep("playground")}>
              ← Change playground
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack stack-5">

      {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
      <header className="aud-hero">
        <div className="aud-hero-eyebrow">
          <span className="section-label">Audience profile</span>
          {isAdjacent ? (
            <span className="pg-chip pg-chip-adj">Adjacent</span>
          ) : (
            <span className="pg-chip pg-chip-rec">Core match</span>
          )}
          <span className="chip" style={{ fontSize: "11px", opacity: 0.65 }}>Synthetic demo data</span>
        </div>

        <h2 className="aud-hero-name">{playgroundName}</h2>
        <p className="aud-hero-headline">{profile.headline}</p>

        <div className="aud-hero-stats" role="group" aria-label="Key demographics">
          <div className="aud-hero-stat">
            <span className="aud-hero-stat-label">Age range</span>
            <span className="aud-hero-stat-value">{profile.demographics.age}</span>
          </div>
          <span className="aud-hero-stat-sep" aria-hidden="true" />
          <div className="aud-hero-stat">
            <span className="aud-hero-stat-label">Gender</span>
            <span className="aud-hero-stat-value">{profile.demographics.skew}</span>
          </div>
          <span className="aud-hero-stat-sep" aria-hidden="true" />
          <div className="aud-hero-stat">
            <span className="aud-hero-stat-label">Life stage</span>
            <span className="aud-hero-stat-value">
              {profile.demographics.lifestage.slice(0, 2).join(", ")}
              {profile.demographics.lifestage.length > 2
                ? ` +${profile.demographics.lifestage.length - 2} more`
                : ""}
            </span>
          </div>
        </div>

        {isAdjacent && props.selectedPlayground.audienceAlignment?.note ? (
          <div className="banner adjacent" style={{ marginTop: "var(--s3)" }}>
            <strong>Expansion play:</strong>{" "}
            {props.audienceKeyword} audiences are a high-growth segment in this playground — not the primary demographic.
            {" "}{props.selectedPlayground.audienceAlignment.note}
          </div>
        ) : null}
      </header>

      {/* ── 2. Planner insight — promoted ────────────────────────────────── */}
      {profile.plannerNote ? <PlannerNote note={profile.plannerNote} /> : null}

      {/* ── 3. Uploaded audience data (if CSV present) ────────────────────── */}
      {hasRealData && props.audienceInsights ? (
        <RealDataPanel insights={props.audienceInsights} />
      ) : null}

      {/* ── 4. Where to reach them ───────────────────────────────────────── */}
      {profile.mediaOwners.length > 0 ? (
        <MediaOwnersSection owners={profile.mediaOwners} />
      ) : null}

      {/* ── 5. What they care about ──────────────────────────────────────── */}
      <CulturalSignalsSection
        watching={profile.watching}
        listening={profile.listening}
        events={profile.events}
        platforms={profile.platforms}
      />

      {/* ── 6. Paid media targeting (accordion) ──────────────────────────── */}
      {profile.targeting.length > 0 ? (
        <Accordion
          label="Paid media targeting signals"
          open={targetingOpen}
          onToggle={() => setTargetingOpen((p) => !p)}
        >
          <div className="aud-targeting-grid">
            {profile.targeting.map((t) => (
              <div key={t.platform} className="aud-targeting-card">
                <div className="aud-targeting-platform">
                  <span
                    className="aud-platform-dot"
                    style={{ background: PLATFORM_COLOR[t.platform] ?? "var(--c-border-strong)" }}
                    aria-hidden="true"
                  />
                  <strong style={{ fontSize: "12px" }}>{t.platform}</strong>
                </div>
                <ul className="aud-targeting-signals" aria-label={`${t.platform} targeting signals`}>
                  {t.signals.map((s) => (
                    <li key={s} className="aud-targeting-signal">{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Accordion>
      ) : null}

      {/* ── 7. Full demographics (accordion) ──────────────────────────────── */}
      <Accordion
        label="About this audience"
        open={demoOpen}
        onToggle={() => setDemoOpen((p) => !p)}
      >
        <p className="small text-secondary" style={{ marginBottom: "var(--s4)", lineHeight: 1.6 }}>
          {profile.description}
        </p>
        <div className="demo-stat-row">
          <div className="demo-stat">
            <span className="demo-stat-label">Age range</span>
            <span className="demo-stat-value">{profile.demographics.age}</span>
          </div>
          <div className="demo-stat">
            <span className="demo-stat-label">Gender skew</span>
            <span className="demo-stat-value">{profile.demographics.skew}</span>
          </div>
          <div className="demo-stat" style={{ flex: 2 }}>
            <span className="demo-stat-label">Life stage</span>
            <div className="meta" style={{ marginTop: "var(--s2)" }}>
              {profile.demographics.lifestage.map((ls) => (
                <span className="chip" key={ls} style={{ fontSize: "11px" }}>{ls}</span>
              ))}
            </div>
          </div>
        </div>
      </Accordion>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="actions">
        <button
          type="button"
          disabled={props.busyBuildBrief}
          onClick={() => void props.onBuildBrief()}
        >
          {props.busyBuildBrief ? "Building brief…" : "Build brief →"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => props.setStep("playground")}
        >
          ← Change playground
        </button>
      </div>

    </div>
  );
}
