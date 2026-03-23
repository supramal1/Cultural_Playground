"use client";

import { wikiScale, trendsScale, redditScale } from "@/lib/signalScale";
import type { CultureBotState } from "@/app/hooks/useCultureBot";

type Props = Pick<
  CultureBotState,
  | "proofOpen"
  | "setProofOpen"
  | "playgroundMeta"
  | "playgroundWarnings"
  | "planData"
  | "brandSignals"
  | "brandDiscourseContext"
  | "playgroundContext"
  | "opportunityContext"
  | "audienceInsights"
  | "searchInsights"
  | "audienceUpload"
  | "searchUpload"
  | "selectedPointer"
  | "pointerValue"
>;

export default function ProofPanel(props: Props) {
  if (!props.proofOpen) return null;

  const trendingQueries   = props.planData?.signals.googleTrends?.topRelatedQueries ?? [];
  const redditThemes      = props.planData?.signals.reddit?.commonThemes ?? [];
  const wikiEntities      = props.planData?.signals.wikimedia?.entities ?? [];
  const guardianArticles  = props.planData?.signals.guardian?.articles ?? [];
  const perplexitySources = [
    ...(props.brandDiscourseContext?.citations ?? []),
    ...(props.playgroundContext?.sources ?? []),
    ...(props.opportunityContext?.sources ?? [])
  ];
  const searchQueries = props.searchInsights?.queriesLatestMonth.byTrend.fastRising ?? [];
  const audienceAffinities = props.audienceInsights?.topAffinities ?? [];
  const brandSubreddits = props.brandSignals?.brandSubreddits ?? [];

  return (
    <div className="drawer-overlay" role="dialog" aria-label="Proof and evidence panel">
      {/* Clicking overlay closes the drawer */}
      <div
        style={{ position: "absolute", inset: 0 }}
        onClick={() => props.setProofOpen(false)}
        aria-hidden="true"
      />

      <aside className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: "16px" }}>Proof &amp; evidence</h2>
            <p className="small text-muted" style={{ marginTop: "2px" }}>
              Sources used to score and validate this playground.
            </p>
          </div>
          <button
            type="button"
            className="secondary btn-sm"
            onClick={() => props.setProofOpen(false)}
            aria-label="Close proof panel"
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          {/* ── Demand ── */}
          <section>
            <span className="section-label">Demand signals</span>
            <div className="evidence-grid">
              {trendingQueries.length > 0 ? (
                <div className="evidence-card">
                  <h4>Google Trends</h4>
                  <ul>
                    {trendingQueries.slice(0, 6).map((item, i) => (
                      <li key={`trend-${i}`}>
                        {item.query}
                        {item.type === "rising" && item.value ? (
                          <em style={{ color: "var(--c-ink-3)" }}> — {trendsScale(item.value)}</em>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {searchQueries.length > 0 ? (
                <div className="evidence-card">
                  <h4>Search CSV</h4>
                  <ul>
                    {searchQueries.slice(0, 6).map((item, i) => (
                      <li key={`search-${i}`}>{item.query}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Conversation ── */}
          <section>
            <span className="section-label">Conversation signals</span>
            <div className="evidence-grid">
              {redditThemes.length > 0 || brandSubreddits.length > 0 ? (
                <div className="evidence-card">
                  <h4>Reddit</h4>
                  <ul>
                    {redditThemes.slice(0, 5).map((t, i) => (
                      <li key={`reddit-${i}`}>{t}</li>
                    ))}
                    {brandSubreddits.slice(0, 3).map((s, i) => (
                      <li key={`bsub-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {audienceAffinities.length > 0 ? (
                <div className="evidence-card">
                  <h4>Audience affinities</h4>
                  <ul>
                    {audienceAffinities.slice(0, 5).map((a, i) => (
                      <li key={`aud-${i}`}>{a.item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Attention ── */}
          {wikiEntities.length > 0 ? (
            <section>
              <span className="section-label">Attention (Wikimedia)</span>
              <div className="evidence-card">
                <h4>Page views</h4>
                <ul>
                  {wikiEntities.slice(0, 5).map((entity, i) => (
                    <li key={`wiki-${i}`}>
                      {entity.title}{" "}
                      <span style={{ color: "var(--c-ink-3)" }}>
                        ({entity.total.toLocaleString()}) — {wikiScale(entity.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {/* ── News ── */}
          {guardianArticles.length > 0 ? (
            <section>
              <span className="section-label">News signal (The Guardian)</span>
              <div className="evidence-card">
                <h4>Recent articles</h4>
                <ul>
                  {guardianArticles.slice(0, 5).map((article, i) => (
                    <li key={`guardian-${i}`}>
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.title}
                      </a>{" "}
                      <span style={{ color: "var(--c-ink-3)" }}>({article.section})</span>
                    </li>
                  ))}
                </ul>
                {(props.planData?.signals.guardian?.topSections ?? []).length > 0 ? (
                  <p className="small text-muted" style={{ marginTop: "var(--s2)" }}>
                    Top sections: {props.planData?.signals.guardian?.topSections?.join(", ")}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* ── Perplexity sources ── */}
          {perplexitySources.length > 0 ? (
            <section>
              <span className="section-label">Perplexity sources</span>
              <div className="evidence-card">
                <h4>Web references</h4>
                <ul>
                  {perplexitySources.slice(0, 8).map((s, i) => (
                    <li key={`pplx-${i}`}>
                      <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    </li>
                  ))}
                </ul>
                <p className="small text-muted" style={{ marginTop: "var(--s2)" }}>
                  Perplexity is best-effort and non-blocking.
                </p>
              </div>
            </section>
          ) : null}

          {/* ── Query strategy ── */}
          <section>
            <span className="section-label">Query strategy</span>
            <details>
              <summary className="small" style={{ cursor: "pointer", color: "var(--c-ink-2)", fontWeight: 600 }}>
                View query JSON
              </summary>
              <pre className="proof-pre">
                {JSON.stringify(
                  props.playgroundMeta?.queryStrategy ?? props.planData?.meta.queryStrategy ?? {},
                  null,
                  2
                )}
              </pre>
            </details>
          </section>

          {/* ── Diagnostics ── */}
          <section>
            <span className="section-label">Diagnostics</span>
            <details>
              <summary className="small" style={{ cursor: "pointer", color: "var(--c-ink-2)", fontWeight: 600 }}>
                View diagnostics JSON
              </summary>
              <pre className="proof-pre">
                {JSON.stringify(
                  {
                    playgroundWarnings: props.playgroundWarnings,
                    planWarnings:       props.planData?.meta.warnings ?? [],
                    brandWarnings:      props.brandSignals?.warnings ?? [],
                    audienceUpload:     props.audienceUpload,
                    searchUpload:       props.searchUpload,
                    selectedPointer:    props.selectedPointer,
                    pointerValue:       props.pointerValue
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </section>

        </div>
      </aside>
    </div>
  );
}
