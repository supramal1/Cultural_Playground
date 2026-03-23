"use client";

import { useState } from "react";
import { CATEGORIES, type CultureBotState } from "@/app/hooks/useCultureBot";

const DEMO_BRIEF = {
  brand: "Airbnb",
  audience: "Gen Z students",
  boost: "city break, weekend away, self-catering"
};

type Props = Pick<
  CultureBotState,
  | "brand"
  | "setBrand"
  | "objectivePreset"
  | "setObjectivePreset"
  | "objectiveCustom"
  | "setObjectiveCustom"
  | "audienceKeyword"
  | "setAudienceKeyword"
  | "datePreset"
  | "setDatePreset"
  | "from"
  | "setFrom"
  | "to"
  | "setTo"
  | "boostKeywords"
  | "setBoostKeywords"
  | "categoryState"
  | "setCategoryState"
  | "audienceUpload"
  | "searchUpload"
  | "insightsPayload"
  | "busyGeneratePlaygrounds"
  | "uploadInsights"
  | "onGeneratePlaygrounds"
>;

async function fetchDemoFile(path: string, filename: string): Promise<File> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch demo file: ${path}`);
  const text = await response.text();
  return new File([text], filename, { type: "text/csv" });
}

export default function BriefForm(props: Props) {
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  async function loadDemo() {
    setDemoLoading(true);
    setDemoLoaded(false);
    try {
      const [audienceFile, searchFile] = await Promise.all([
        fetchDemoFile("/demo/demo-audience.csv", "demo-audience.csv"),
        fetchDemoFile("/demo/demo-search.csv", "demo-search.csv")
      ]);
      props.setBrand(DEMO_BRIEF.brand);
      props.setObjectivePreset("Awareness");
      props.setAudienceKeyword(DEMO_BRIEF.audience);
      props.setBoostKeywords(DEMO_BRIEF.boost);
      props.setDatePreset("8w");
      await Promise.all([
        props.uploadInsights("audience", audienceFile),
        props.uploadInsights("search", searchFile)
      ]);
      setDemoLoaded(true);
    } catch (err) {
      console.error("Demo load failed", err);
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="stack stack-6">

      {/* ── Section: Brand + Objective ── */}
      <section className="card">
        <div className="panel-head" style={{ marginBottom: "var(--s5)" }}>
          <div>
            <h2>Campaign brief</h2>
            <p className="small text-muted" style={{ marginTop: "var(--s1)" }}>
              Define the brand, objective, and audience you're planning for.
            </p>
          </div>
          <button
            type="button"
            className="secondary btn-sm no-print"
            disabled={demoLoading}
            onClick={() => void loadDemo()}
          >
            {demoLoading ? "Loading…" : "Load demo"}
          </button>
        </div>

        {demoLoaded ? (
          <div className="banner banner-success" style={{ marginBottom: "var(--s4)" }}>
            Demo brief loaded — Airbnb × Gen Z Students with synthetic CSV data.
          </div>
        ) : null}

        <div className="row" style={{ marginBottom: "var(--s4)" }}>
          <div>
            <label htmlFor="brand">Brand</label>
            <input
              id="brand"
              value={props.brand}
              onChange={(e) => props.setBrand(e.target.value)}
              placeholder="e.g. Nike"
            />
          </div>
          <div>
            <label htmlFor="objective">Campaign objective</label>
            <select
              id="objective"
              value={props.objectivePreset}
              onChange={(e) => props.setObjectivePreset(e.target.value)}
            >
              <option>Awareness</option>
              <option>Consideration</option>
              <option>Conversion</option>
              <option>Custom</option>
            </select>
          </div>
        </div>

        {props.objectivePreset === "Custom" ? (
          <div style={{ marginBottom: "var(--s4)" }}>
            <label htmlFor="objectiveCustom">Custom objective</label>
            <input
              id="objectiveCustom"
              value={props.objectiveCustom}
              onChange={(e) => props.setObjectiveCustom(e.target.value)}
              placeholder="e.g. Drive trial in Q2"
            />
          </div>
        ) : null}

        <div className="row">
          <div>
            <label htmlFor="audience">
              Target audience <span style={{ color: "var(--c-accent)", fontWeight: 700 }}>*</span>
            </label>
            <input
              id="audience"
              value={props.audienceKeyword}
              onChange={(e) => props.setAudienceKeyword(e.target.value)}
              placeholder="e.g. Gen Z football fans"
            />
          </div>
          <div>
            <label htmlFor="boost">Boost keywords</label>
            <input
              id="boost"
              value={props.boostKeywords}
              onChange={(e) => props.setBoostKeywords(e.target.value)}
              placeholder="Arsenal, away kit, watch party"
            />
          </div>
        </div>
      </section>

      {/* ── Section: Date window + Categories ── */}
      <section className="card">
        <h3 style={{ marginBottom: "var(--s4)" }}>Date window &amp; categories</h3>

        <div className="row" style={{ marginBottom: "var(--s4)" }}>
          <div>
            <label>Date window</label>
            <div className="actions">
              {(["4w", "8w", "custom"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={props.datePreset === preset ? "" : "secondary"}
                  onClick={() => props.setDatePreset(preset)}
                >
                  {preset === "4w" ? "4 weeks" : preset === "8w" ? "8 weeks" : "Custom"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label>Categories</label>
            <div className="meta">
              {CATEGORIES.map((cat) => (
                <label key={cat} className="filter-chip">
                  <input
                    type="checkbox"
                    checked={props.categoryState[cat]}
                    onChange={(e) =>
                      props.setCategoryState((prev) => ({
                        ...prev,
                        [cat]: e.target.checked
                      }))
                    }
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>
        </div>

        {props.datePreset === "custom" ? (
          <div className="row">
            <div>
              <label htmlFor="from">From</label>
              <input
                id="from"
                type="date"
                value={props.from}
                onChange={(e) => props.setFrom(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="to">To</label>
              <input
                id="to"
                type="date"
                value={props.to}
                onChange={(e) => props.setTo(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Section: Data uploads ── */}
      <section className="card">
        <div style={{ marginBottom: "var(--s4)" }}>
          <h3>Data uploads</h3>
          <p className="small text-muted" style={{ marginTop: "var(--s1)" }}>
            Optional CSVs enrich playground scoring with your own audience and search data.
          </p>
        </div>

        <div className="row">
          <div>
            <label htmlFor="audienceCsv">Audience CSV</label>
            <input
              id="audienceCsv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void props.uploadInsights("audience", file);
                e.currentTarget.value = "";
              }}
            />
            <div className="small text-muted" style={{ marginTop: "var(--s2)" }}>
              {props.audienceUpload.status === "OK" && props.insightsPayload?.audience ? (
                <span className="chip" style={{ fontSize: "11px" }}>
                  ✓ {props.audienceUpload.debug?.parsedRowCount ?? "?"} rows
                  {props.insightsPayload.audience.topAffinities.length > 0
                    ? ` · ${props.insightsPayload.audience.topAffinities.length} affinities`
                    : ""}
                </span>
              ) : props.audienceUpload.status === "FAILED" ? (
                <span style={{ color: "var(--c-danger)", fontSize: "12px" }}>
                  Failed: {props.audienceUpload.error ?? "unknown error"}
                </span>
              ) : (
                <span style={{ fontSize: "12px" }}>Status: {props.audienceUpload.status}</span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="searchCsv">Search CSV</label>
            <input
              id="searchCsv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void props.uploadInsights("search", file);
                e.currentTarget.value = "";
              }}
            />
            <div className="small text-muted" style={{ marginTop: "var(--s2)" }}>
              {props.searchUpload.status === "OK" && props.insightsPayload?.search ? (
                <span className="chip" style={{ fontSize: "11px" }}>
                  ✓ {props.searchUpload.debug?.parsedRowCount ?? "?"} rows
                  {props.insightsPayload.search.derived.seedKeywords.length > 0
                    ? ` · ${props.insightsPayload.search.derived.seedKeywords.length} keywords`
                    : ""}
                </span>
              ) : props.searchUpload.status === "FAILED" ? (
                <span style={{ color: "var(--c-danger)", fontSize: "12px" }}>
                  Failed: {props.searchUpload.error ?? "unknown error"}
                </span>
              ) : (
                <span style={{ fontSize: "12px" }}>Status: {props.searchUpload.status}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="actions">
        <button
          type="button"
          disabled={props.busyGeneratePlaygrounds || !props.audienceKeyword.trim()}
          onClick={() => void props.onGeneratePlaygrounds(false)}
        >
          {props.busyGeneratePlaygrounds ? "Generating…" : "Generate playgrounds →"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={props.busyGeneratePlaygrounds}
          onClick={() => void props.onGeneratePlaygrounds(true)}
        >
          Skip — pick manually
        </button>
        {!props.audienceKeyword.trim() ? (
          <span className="small text-muted">Audience is required to generate playgrounds.</span>
        ) : null}
      </div>

    </div>
  );
}
