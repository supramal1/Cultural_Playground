"use client";

import { useState, useMemo } from "react";
import { MAX_MOMENTS_TO_BUILD } from "@/lib/config";
import { formatDateTime, pointerLabel, type CultureBotState } from "@/app/hooks/useCultureBot";

type RegenerateMode = "regenerate" | "tighten" | "specific";

type Props = Pick<
  CultureBotState,
  | "mediaBrief"
  | "setMediaBrief"
  | "planData"
  | "opportunityContext"
  | "selectedMomentIds"
  | "busyMoments"
  | "slide"
  | "onLoadMoments"
  | "toggleMoment"
  | "onRegenerateBlock"
  | "onGenerateSlideJson"
  | "copyEmailBrief"
  | "copyMarkdownBrief"
  | "downloadOpportunitiesCsv"
  | "setSelectedPointer"
  | "setStep"
  | "setProofOpen"
  | "downloadPdf"
>;

const RESPONSE_CHECKLIST = [
  "Explain why this cultural moment is relevant to your audience",
  "Propose specific format(s) and placement(s)",
  "Include indicative pricing and impressions/reach",
  "Share examples of similar brand or category partnerships",
  "Confirm audience overlap data for this playground",
  "Outline timeline, lead-in requirements, and key deliverable dates"
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function completionOf(value: string | string[] | null | undefined): 0 | 1 | 2 {
  if (!value) return 0;
  if (typeof value === "string") {
    const t = value.trim();
    if (t.length < 20) return 0;
    if (t.length < 120) return 1;
    return 2;
  }
  if (Array.isArray(value)) {
    const n = value.filter(Boolean).length;
    if (n === 0) return 0;
    if (n < 3) return 1;
    return 2;
  }
  return 0;
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

function tierClass(tier?: string): string {
  if (tier === "flagship") return "moment moment-flagship";
  if (tier === "filler")   return "moment moment-filler";
  return "moment moment-notable";
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function CompletionDots({ level }: { level: 0 | 1 | 2 }) {
  // level 0 → ○○○, level 1 → ●○○, level 2 → ●●●
  const filledCount = level === 0 ? 0 : level === 1 ? 1 : 3;
  const label = ["Empty", "In progress", "Complete"][level];
  return (
    <span className="bb-completion" aria-label={label} title={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`bb-dot${i < filledCount ? " is-filled" : ""}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function RegenMenu({
  blockName,
  options,
  onRegen
}: {
  blockName: string;
  options: { label: string; mode: RegenerateMode }[];
  onRegen: (mode: RegenerateMode, block: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bb-regen-wrap no-print">
      <button
        type="button"
        className="bb-regen-trigger"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Regenerate: ${blockName}`}
        title="Regenerate options"
      >
        ⟳
      </button>
      {open && (
        <>
          <div
            className="bb-regen-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="bb-regen-menu" role="menu">
            {options.map(({ label, mode }) => (
              <button
                key={mode}
                type="button"
                role="menuitem"
                className="bb-regen-item"
                onClick={() => {
                  setOpen(false);
                  onRegen(mode, blockName);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionCard({
  title,
  completion,
  blockName,
  regenOptions,
  onRegen,
  children
}: {
  title: string;
  completion: 0 | 1 | 2;
  blockName?: string;
  regenOptions?: { label: string; mode: RegenerateMode }[];
  onRegen?: (mode: RegenerateMode, block: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="bb-section">
      <div className="bb-section-head">
        <div className="bb-section-title-row">
          <CompletionDots level={completion} />
          <h3 className="bb-section-title">{title}</h3>
        </div>
        {blockName && regenOptions && onRegen ? (
          <RegenMenu blockName={blockName} options={regenOptions} onRegen={onRegen} />
        ) : null}
      </div>
      <div className="bb-section-body">{children}</div>
    </section>
  );
}

function EditableList({
  items,
  icon,
  iconColor,
  maxItems,
  addLabel,
  placeholder,
  onChange
}: {
  items: string[];
  icon: string;
  iconColor?: string;
  maxItems: number;
  addLabel: string;
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <>
      <div className="bb-list">
        {items.map((item, i) => (
          <div key={i} className="bb-list-row">
            <span
              className="bb-list-icon"
              style={iconColor ? { color: iconColor } : undefined}
              aria-hidden="true"
            >
              {icon}
            </span>
            <input
              className="bb-list-input"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="bb-list-remove no-print"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              aria-label="Remove item"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {items.length < maxItems ? (
        <button
          type="button"
          className="bb-list-add no-print"
          onClick={() => onChange([...items, ""])}
        >
          + {addLabel}
        </button>
      ) : null}
    </>
  );
}

// ─── Week bucket type ─────────────────────────────────────────────────────────
type WeekBucket = { label: string; count: number; flagship: number };

// ─── Main component ───────────────────────────────────────────────────────────

export default function BriefBuilder(props: Props) {
  const { mediaBrief } = props;

  const weekBuckets = useMemo<WeekBucket[]>(() => {
    if (!props.planData?.moments.length) return [];
    const moments = props.planData.moments.slice(0, MAX_MOMENTS_TO_BUILD);
    const sorted  = [...moments].sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );
    if (!sorted.length) return [];
    const firstDate = new Date(sorted[0].startDateTime);
    const lastDate  = new Date(sorted[sorted.length - 1].startDateTime);
    const buckets: WeekBucket[] = [];
    const cursor = new Date(firstDate);
    cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay() + 1);
    while (cursor.getTime() <= lastDate.getTime() + 7 * 24 * 60 * 60 * 1000) {
      const weekStart = new Date(cursor);
      const weekEnd   = new Date(cursor);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const inWeek = sorted.filter((m) => {
        const t = new Date(m.startDateTime).getTime();
        return t >= weekStart.getTime() && t <= weekEnd.getTime();
      });
      buckets.push({
        label:    weekLabel(weekStart.toISOString()),
        count:    inWeek.length,
        flagship: inWeek.filter((m) => m.qualityTier === "flagship").length
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      if (buckets.length >= 14) break;
    }
    return buckets;
  }, [props.planData?.moments]);

  const maxCount       = Math.max(1, ...weekBuckets.map((b) => b.count));
  const playgroundName = props.planData?.playground.candidate.name ?? null;
  const categories     = props.planData?.playground.candidate.recommendedCategories ?? [];

  const handleRegen = (mode: RegenerateMode, block: string) => {
    void props.onRegenerateBlock(mode, block);
  };

  // ── Null state ─────────────────────────────────────────────────────────────
  if (!mediaBrief) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: "var(--s3)" }}>Brief builder</h2>
        <p className="text-muted">Select a playground and build a brief to see the document.</p>
      </div>
    );
  }

  return (
    <div className="bb-doc">

      {/* ── Document header (screen only) ────────────────────────────────── */}
      <header className="bb-doc-header no-print">
        <div className="bb-doc-header-left">
          <h2 className="bb-doc-title">{playgroundName ?? "Media Owner Brief"}</h2>
          <div className="bb-doc-meta">
            {categories.map((cat) => (
              <span key={cat} className="chip" style={{ fontSize: "10px" }}>{cat}</span>
            ))}
            {(props.planData?.meta.keywordSetInPlay ?? []).slice(0, 3).map((kw) => (
              <span key={kw} className="bb-doc-kw">{kw}</span>
            ))}
          </div>
        </div>
        <span className="bb-status-badge">Draft</span>
      </header>

      {/* ── Print header ─────────────────────────────────────────────────── */}
      <header className="bb-print-header">
        <div className="bb-print-title">{playgroundName ?? "Media Owner Brief"}</div>
        <div className="bb-print-meta">
          CultureBot ·{" "}
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric"
          })}
        </div>
      </header>

      {/* ── 1. Brief one-liner + timing ──────────────────────────────────── */}
      <SectionCard
        title="Brief one-liner"
        completion={completionOf(mediaBrief.briefOneLiner)}
        blockName="brief one-liner"
        regenOptions={[
          { label: "Regenerate", mode: "regenerate" },
          { label: "Tighten",    mode: "tighten"    },
          { label: "Specific",   mode: "specific"   }
        ]}
        onRegen={handleRegen}
      >
        <textarea
          className="bb-textarea bb-textarea-hero"
          value={mediaBrief.briefOneLiner}
          placeholder="A single compelling sentence that captures the brief…"
          onChange={(e) =>
            props.setMediaBrief({ ...mediaBrief, briefOneLiner: e.target.value })
          }
        />

        {/* Timing strip */}
        <div className="bb-timing-strip">
          {(["leadInDays", "peakDays", "coolDownDays"] as const).map((key) => {
            const labels: Record<string, string> = {
              leadInDays:   "Lead-in",
              peakDays:     "Peak",
              coolDownDays: "Cool-down"
            };
            const modifiers: Record<string, string> = {
              leadInDays:   "",
              peakDays:     " bb-timing-peak",
              coolDownDays: ""
            };
            return (
              <div key={key} className={`bb-timing-block${modifiers[key]}`}>
                <span className="bb-timing-label">{labels[key]}</span>
                <input
                  type="number"
                  className="bb-timing-input"
                  min={0}
                  max={key === "peakDays" ? 60 : 90}
                  value={mediaBrief.timing[key]}
                  onChange={(e) =>
                    props.setMediaBrief({
                      ...mediaBrief,
                      timing: { ...mediaBrief.timing, [key]: Number(e.target.value) }
                    })
                  }
                />
                <span className="bb-timing-unit">d</span>
              </div>
            );
          })}
          <div className="bb-timing-block bb-timing-total">
            <span className="bb-timing-label">Total</span>
            <span className="bb-timing-total-val">
              {mediaBrief.timing.leadInDays +
               mediaBrief.timing.peakDays +
               mediaBrief.timing.coolDownDays}d
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Objective + KPI ───────────────────────────────────────────── */}
      <SectionCard
        title="Objective + KPI"
        completion={completionOf(mediaBrief.objectiveKpi)}
        blockName="objective + kpi"
        regenOptions={[
          { label: "Regenerate", mode: "regenerate" },
          { label: "Specific",   mode: "specific"   }
        ]}
        onRegen={handleRegen}
      >
        <textarea
          className="bb-textarea"
          value={mediaBrief.objectiveKpi}
          placeholder="Campaign objective and specific KPI…"
          onChange={(e) =>
            props.setMediaBrief({ ...mediaBrief, objectiveKpi: e.target.value })
          }
        />
      </SectionCard>

      {/* ── 3. Audience mindset ──────────────────────────────────────────── */}
      <SectionCard
        title="Audience mindset"
        completion={completionOf(mediaBrief.audienceMindset)}
        blockName="audience mindset"
        regenOptions={[
          { label: "Regenerate", mode: "regenerate" },
          { label: "Tighten",    mode: "tighten"    }
        ]}
        onRegen={handleRegen}
      >
        <textarea
          className="bb-textarea"
          value={mediaBrief.audienceMindset}
          placeholder="Emotional state and behaviour in the moment…"
          onChange={(e) =>
            props.setMediaBrief({ ...mediaBrief, audienceMindset: e.target.value })
          }
        />
      </SectionCard>

      {/* ── 4. Cultural insight (snapshot + tension + timing) ────────────── */}
      <SectionCard
        title="Cultural insight"
        completion={completionOf(
          [mediaBrief.cultureSnapshot, mediaBrief.culturalTension, mediaBrief.timingWindow]
            .filter(Boolean)
            .join(" ")
        )}
      >
        <div className="bb-insight-grid">
          {(
            [
              {
                key: "cultureSnapshot" as const,
                label: "Culture snapshot",
                block: "culture snapshot"
              },
              {
                key: "culturalTension" as const,
                label: "Cultural tension",
                block: "cultural tension"
              },
              {
                key: "timingWindow" as const,
                label: "Timing window",
                block: "timing window"
              }
            ] as const
          )
            .filter(({ key }) => !!mediaBrief[key])
            .map(({ key, label, block }) => (
              <div key={key} className="bb-insight-block">
                <div className="bb-insight-block-head">
                  <span className="bb-insight-label">{label}</span>
                  <RegenMenu
                    blockName={block}
                    options={[
                      { label: "Regenerate", mode: "regenerate" },
                      { label: "Tighten",    mode: "tighten"    }
                    ]}
                    onRegen={handleRegen}
                  />
                </div>
                <textarea
                  className="bb-textarea"
                  value={mediaBrief[key] ?? ""}
                  onChange={(e) =>
                    props.setMediaBrief({ ...mediaBrief, [key]: e.target.value })
                  }
                />
              </div>
            ))}
        </div>
      </SectionCard>

      {/* ── 5. Playground + culture codes ───────────────────────────────── */}
      <SectionCard
        title="Playground + culture codes"
        completion={completionOf(mediaBrief.playgroundDefinitionCodes)}
        blockName="playground + codes"
        regenOptions={[
          { label: "Regenerate", mode: "regenerate" },
          { label: "Specific",   mode: "specific"   }
        ]}
        onRegen={handleRegen}
      >
        <textarea
          className="bb-textarea"
          value={mediaBrief.playgroundDefinitionCodes}
          placeholder="Cultural space definition and culture codes for this playground…"
          onChange={(e) =>
            props.setMediaBrief({
              ...mediaBrief,
              playgroundDefinitionCodes: e.target.value
            })
          }
        />
      </SectionCard>

      {/* ── 6. The Ask ───────────────────────────────────────────────────── */}
      <SectionCard
        title="The ask"
        completion={completionOf(mediaBrief.theAsk)}
        blockName="the ask"
        regenOptions={[
          { label: "Regenerate", mode: "regenerate" },
          { label: "Specific",   mode: "specific"   }
        ]}
        onRegen={handleRegen}
      >
        <textarea
          className="bb-textarea bb-textarea-ask"
          value={mediaBrief.theAsk}
          placeholder="One clear, actionable sentence — what you need from the media owner…"
          onChange={(e) =>
            props.setMediaBrief({ ...mediaBrief, theAsk: e.target.value })
          }
        />
      </SectionCard>

      {/* ── 7. Deliverables ──────────────────────────────────────────────── */}
      <SectionCard
        title="Deliverables"
        completion={completionOf(mediaBrief.deliverables)}
      >
        <EditableList
          items={mediaBrief.deliverables}
          icon="☐"
          maxItems={6}
          addLabel="Add deliverable"
          placeholder="Specific output with format and quantity…"
          onChange={(next) =>
            props.setMediaBrief({ ...mediaBrief, deliverables: next })
          }
        />
      </SectionCard>

      {/* ── 8. Guardrails ────────────────────────────────────────────────── */}
      <SectionCard
        title="Guardrails"
        completion={completionOf(mediaBrief.guardrails)}
      >
        <EditableList
          items={mediaBrief.guardrails}
          icon="✕"
          iconColor="var(--c-danger)"
          maxItems={8}
          addLabel="Add guardrail"
          placeholder="Brand safety, legal constraint, or risk mitigation…"
          onChange={(next) =>
            props.setMediaBrief({ ...mediaBrief, guardrails: next })
          }
        />
      </SectionCard>

      {/* ── 9. Response checklist (non-print) ───────────────────────────── */}
      <div className="bb-checklist no-print">
        <span className="bb-checklist-label">What to include in the response</span>
        <div className="bb-checklist-grid">
          {RESPONSE_CHECKLIST.map((item) => (
            <div key={item} className="bb-checklist-item">
              <span className="bb-checklist-dot" aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 10. Supporting moments (non-print) ───────────────────────────── */}
      <section className="bb-section no-print">
        <div className="bb-section-head">
          <div className="bb-section-title-row">
            <CompletionDots level={completionOf(props.selectedMomentIds)} />
            <h3 className="bb-section-title">Supporting moments</h3>
          </div>
          <button
            type="button"
            className="secondary btn-sm"
            onClick={() => void props.onLoadMoments()}
            disabled={props.busyMoments}
          >
            {props.busyMoments ? "Loading…" : props.planData ? "Refresh" : "Load moments"}
          </button>
        </div>

        {!props.planData ? (
          <div className="bb-section-body">
            <p className="small text-muted">
              Moments enrich the brief with cultural anchors — optional but recommended.
            </p>
          </div>
        ) : props.planData.moments.length === 0 ? (
          <div className="bb-section-body">
            <p className="small text-muted">No moments found for this date window and categories.</p>
          </div>
        ) : (
          <div className="bb-section-body">
            <p className="small text-muted" style={{ marginBottom: "var(--s4)" }}>
              {props.planData.moments.length} moments found.
              {props.selectedMomentIds.length > 0
                ? ` ${props.selectedMomentIds.length} selected.`
                : " Select 3–5 flagship moments to enrich the brief."}
            </p>

            {/* Density chart */}
            {weekBuckets.length > 0 ? (
              <div className="timeline-bar" style={{ marginBottom: "var(--s4)" }}>
                <strong style={{
                  fontSize: "10px",
                  color: "var(--c-ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  Moment density
                </strong>
                <div className="timeline-weeks">
                  {weekBuckets.map((b, i) => {
                    const h     = Math.max(2, Math.round((b.count / maxCount) * 40));
                    const color = b.flagship > 0
                      ? "linear-gradient(180deg, var(--c-accent), #93ABEF)"
                      : b.count > 0 ? "var(--c-border-strong)" : "var(--c-border)";
                    return (
                      <div
                        key={`tw-${i}`}
                        className="timeline-week"
                        title={`${b.label}: ${b.count} moment${b.count !== 1 ? "s" : ""}${b.flagship > 0 ? ` (${b.flagship} flagship)` : ""}`}
                      >
                        <div
                          className="timeline-week-bar"
                          style={{ height: `${h}px`, background: color }}
                        />
                        <span className="timeline-week-label">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Moment cards */}
            <div className="tentpole-grid">
              {props.planData.moments.slice(0, MAX_MOMENTS_TO_BUILD).map((moment) => {
                const selected = props.selectedMomentIds.includes(moment.id);
                const context  = props.opportunityContext?.byMomentId[moment.id];
                const chips    = moment.evidencePointers.length > 0
                  ? moment.evidencePointers.slice(0, 3)
                  : (context?.evidencePointers ?? []).slice(0, 2);
                const tier     = moment.qualityTier ?? "notable";

                return (
                  <article
                    className={`${tierClass(tier)} moment-category-${moment.category}`}
                    key={moment.id}
                  >
                    <div className="moment-head">
                      <strong>{moment.title}</strong>
                      <div style={{ display: "flex", gap: "var(--s1)", flexShrink: 0 }}>
                        <span className={`category-badge category-${moment.category}`}>
                          {moment.category}
                        </span>
                        {tier !== "filler" ? (
                          <span
                            className={tier === "flagship" ? "chip tier-badge-flagship" : "chip"}
                            style={{ fontSize: "10px" }}
                          >
                            {tier}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="small text-muted">
                      {formatDateTime(moment.startDateTime)} · score {moment.finalScore.toFixed(1)}
                    </div>

                    {moment.scoreBreakdown ? (
                      <div className="score-breakdown">
                        {moment.scoreBreakdown.proximityBoost > 0 ? (
                          <span className="score-pill" title="How soon this moment occurs">
                            Proximity +{moment.scoreBreakdown.proximityBoost}
                          </span>
                        ) : null}
                        {moment.scoreBreakdown.majorBoost > 0 ? (
                          <span className="score-pill" title="Category importance">
                            Category +{moment.scoreBreakdown.majorBoost}
                          </span>
                        ) : null}
                        {moment.scoreBreakdown.keywordBoost > 0 ? (
                          <span className="score-pill score-pill-accent" title="Matched keywords from your brief">
                            Keyword +{moment.scoreBreakdown.keywordBoost}
                          </span>
                        ) : null}
                        {moment.scoreBreakdown.confidenceBoost > 0 ? (
                          <span className="score-pill" title="Data source reliability">
                            Confidence +{moment.scoreBreakdown.confidenceBoost}
                          </span>
                        ) : null}
                        {(moment.scoreBreakdown.qualityTierBoost ?? 0) > 0 ? (
                          <span className="score-pill" title="Flagship or notable cultural moment">
                            Tier +{moment.scoreBreakdown.qualityTierBoost}
                          </span>
                        ) : null}
                        {moment.signalBoost.total > 0 ? (
                          <span className="score-pill score-pill-accent" title="Signal validation boost">
                            Signal +{moment.signalBoost.total}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="meta" style={{ marginTop: "var(--s3)" }}>
                      {chips.map((pointer, idx) => (
                        <button
                          key={`${moment.id}-chip-${idx}`}
                          type="button"
                          className="secondary pointer-btn"
                          onClick={() => {
                            props.setSelectedPointer(pointer);
                            props.setProofOpen(true);
                          }}
                        >
                          {pointerLabel(pointer)}
                        </button>
                      ))}
                    </div>

                    <div className="small text-secondary" style={{ marginTop: "var(--s2)" }}>
                      {(context?.whyNowBullets ?? []).slice(0, 2).map((item, idx) => (
                        <div key={`${moment.id}-why-${idx}`}>— {item}</div>
                      ))}
                    </div>

                    <div className="actions" style={{ marginTop: "var(--s4)" }}>
                      <button
                        type="button"
                        className={selected ? "secondary" : ""}
                        onClick={() => props.toggleMoment(moment.id)}
                      >
                        {selected ? "Remove" : "Add to brief"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Slide JSON preview ───────────────────────────────────────────── */}
      {props.slide ? (
        <section className="bb-section no-print">
          <div className="bb-section-head">
            <div className="bb-section-title-row">
              <h3 className="bb-section-title">Slide JSON</h3>
            </div>
          </div>
          <div className="bb-section-body">
            <pre className="proof-pre">{JSON.stringify(props.slide, null, 2)}</pre>
          </div>
        </section>
      ) : null}

      {/* ── Sticky export bar (screen only) ─────────────────────────────── */}
      <div className="bb-export-bar no-print" role="toolbar" aria-label="Export and share">
        <button
          type="button"
          className="bb-export-primary"
          onClick={props.downloadPdf}
        >
          ↓ PDF
        </button>
        <div className="bb-export-sep" aria-hidden="true" />
        <button
          type="button"
          className="bb-export-action"
          onClick={() => void props.copyEmailBrief()}
        >
          Email brief
        </button>
        <button
          type="button"
          className="bb-export-action"
          onClick={() => void props.copyMarkdownBrief()}
        >
          Markdown
        </button>
        <button
          type="button"
          className="bb-export-action"
          onClick={() => void props.onGenerateSlideJson()}
        >
          Slide JSON
        </button>
        <button
          type="button"
          className="bb-export-action"
          onClick={props.downloadOpportunitiesCsv}
          disabled={!props.planData}
        >
          CSV
        </button>
      </div>

    </div>
  );
}
