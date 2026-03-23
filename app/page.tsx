"use client";

import { useState } from "react";
import { useCultureBot } from "@/app/hooks/useCultureBot";
import BriefForm from "@/app/components/BriefForm";
import PlaygroundPicker from "@/app/components/PlaygroundPicker";
import AudienceStep from "@/app/components/AudienceStep";
import BriefBuilder from "@/app/components/BriefBuilder";
import ProofPanel from "@/app/components/ProofPanel";
import type { Step } from "@/app/hooks/useCultureBot";

const NAV_STEPS: { id: Step; label: string; sub: string }[] = [
  { id: "brief",      label: "Brief",         sub: "Brand, audience & window" },
  { id: "playground", label: "Playground",     sub: "Cultural territory" },
  { id: "audience",   label: "Audience",       sub: "Who you're reaching" },
  { id: "builder",    label: "Brief Builder",  sub: "Media-owner document" }
];

const STEP_TITLES: Partial<Record<Step, string>> = {
  brief:      "Set the brief",
  playground: "Choose a playground",
  audience:   "Audience profile",
  builder:    "Build your brief"
};

export default function HomePage() {
  const bot = useCultureBot();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stepIndex = NAV_STEPS.findIndex((s) => s.id === bot.step);
  const activeStepIndex = stepIndex >= 0 ? stepIndex : 0;

  const sourceCount =
    (bot.planData?.signals.googleTrends?.topRelatedQueries?.length ?? 0) +
    (bot.planData?.signals.reddit?.commonThemes?.length ?? 0) +
    (bot.planData?.signals.wikimedia?.entities?.length ?? 0) +
    (bot.planData?.signals.guardian?.articles?.length ?? 0) +
    (bot.brandDiscourseContext?.citations?.length ?? 0) +
    (bot.playgroundContext?.sources?.length ?? 0) +
    (bot.opportunityContext?.sources?.length ?? 0);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay no-print"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar no-print${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img
            src="/wpp-media-logo.svg"
            alt="WPP Media"
            className="sidebar-logo"
          />
          <span className="sidebar-product-name">Culture Bot</span>
        </div>

        <nav className="sidebar-nav" aria-label="Workflow steps">
          {NAV_STEPS.map((step, i) => {
            const isDone   = i < activeStepIndex;
            const isActive = step.id === bot.step;
            return (
              <button
                key={step.id}
                type="button"
                className={`nav-item${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                onClick={() => { bot.setStep(step.id); closeSidebar(); }}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="nav-step-icon" aria-hidden="true">
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="nav-step-label">
                  <span className="nav-step-name">{step.label}</span>
                  <span className="nav-step-sub">{step.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="proof-toggle-btn"
            onClick={() => { bot.setProofOpen((prev) => !prev); closeSidebar(); }}
          >
            <span aria-hidden="true">◎</span>
            <span>Proof &amp; sources</span>
            {sourceCount > 0 ? (
              <span className="proof-count-chip">{sourceCount}</span>
            ) : null}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="app-main">

        {/* Topbar */}
        <header className="app-topbar no-print">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Open navigation"
            >
              ☰
            </button>
            <div className="topbar-context">
              {activeStepIndex >= 0 ? (
                <span className="topbar-step-label">
                  Step {activeStepIndex + 1} of {NAV_STEPS.length}
                </span>
              ) : null}
              <h1 className="topbar-title">
                {STEP_TITLES[bot.step] ?? "Culture Bot"}
              </h1>
            </div>
          </div>

          <div className="topbar-pills">
            {bot.brand ? (
              <span className="chip" style={{ fontSize: "12px" }}>{bot.brand}</span>
            ) : null}
            {bot.audienceKeyword ? (
              <span className="chip" style={{ fontSize: "12px" }}>{bot.audienceKeyword}</span>
            ) : null}
          </div>
        </header>

        {/* Loading strip */}
        {bot.isBusy ? (
          <div className="loading-strip no-print" aria-live="polite" role="status">
            <div className="loading-bar">
              <div className="loading-bar-fill" />
            </div>
            <span className="loading-label">{bot.notice || "Running…"}</span>
          </div>
        ) : null}

        {/* Error / notice banners */}
        {bot.error ? (
          <div
            className="banner banner-error no-print"
            role="alert"
            style={{ margin: "var(--s4) var(--s6) 0" }}
          >
            {bot.error}
          </div>
        ) : null}
        {!bot.isBusy && bot.notice ? (
          <div
            className="banner banner-info no-print"
            style={{ margin: "var(--s4) var(--s6) 0" }}
          >
            {bot.notice}
          </div>
        ) : null}

        {/* Step content */}
        <main className="app-content">
          {bot.step === "brief" ? (
            <BriefForm
              brand={bot.brand}
              setBrand={bot.setBrand}
              objectivePreset={bot.objectivePreset}
              setObjectivePreset={bot.setObjectivePreset}
              objectiveCustom={bot.objectiveCustom}
              setObjectiveCustom={bot.setObjectiveCustom}
              audienceKeyword={bot.audienceKeyword}
              setAudienceKeyword={bot.setAudienceKeyword}
              datePreset={bot.datePreset}
              setDatePreset={bot.setDatePreset}
              from={bot.from}
              setFrom={bot.setFrom}
              to={bot.to}
              setTo={bot.setTo}
              boostKeywords={bot.boostKeywords}
              setBoostKeywords={bot.setBoostKeywords}
              categoryState={bot.categoryState}
              setCategoryState={bot.setCategoryState}
              audienceUpload={bot.audienceUpload}
              searchUpload={bot.searchUpload}
              insightsPayload={bot.insightsPayload}
              busyGeneratePlaygrounds={bot.busyGeneratePlaygrounds}
              uploadInsights={bot.uploadInsights}
              onGeneratePlaygrounds={bot.onGeneratePlaygrounds}
            />
          ) : null}

          {bot.step === "playground" ? (
            <PlaygroundPicker
              brand={bot.brand}
              candidates={bot.candidates}
              selectedPlaygroundId={bot.selectedPlaygroundId}
              playgroundWarnings={bot.playgroundWarnings}
              playgroundContext={bot.playgroundContext}
              insightsPayload={bot.insightsPayload}
              busyGeneratePlaygrounds={bot.busyGeneratePlaygrounds}
              onSelectPlayground={bot.onSelectPlayground}
              setSelectedPlaygroundId={bot.setSelectedPlaygroundId}
              setStep={bot.setStep}
              setProofOpen={bot.setProofOpen}
            />
          ) : null}

          {bot.step === "audience" ? (
            <AudienceStep
              selectedPlayground={bot.selectedPlayground}
              audienceKeyword={bot.audienceKeyword}
              audienceInsights={bot.audienceInsights}
              busyBuildBrief={bot.busyBuildBrief}
              onBuildBrief={bot.onBuildBrief}
              setStep={bot.setStep}
            />
          ) : null}

          {bot.step === "builder" ? (
            <BriefBuilder
              mediaBrief={bot.mediaBrief}
              setMediaBrief={bot.setMediaBrief}
              planData={bot.planData}
              opportunityContext={bot.opportunityContext}
              selectedMomentIds={bot.selectedMomentIds}
              busyMoments={bot.busyMoments}
              slide={bot.slide}
              onLoadMoments={bot.onLoadMoments}
              toggleMoment={bot.toggleMoment}
              onRegenerateBlock={bot.onRegenerateBlock}
              onGenerateSlideJson={bot.onGenerateSlideJson}
              copyEmailBrief={bot.copyEmailBrief}
              copyMarkdownBrief={bot.copyMarkdownBrief}
              downloadOpportunitiesCsv={bot.downloadOpportunitiesCsv}
              downloadPdf={bot.downloadPdf}
              setSelectedPointer={bot.setSelectedPointer}
              setStep={bot.setStep}
              setProofOpen={bot.setProofOpen}
            />
          ) : null}
        </main>
      </div>

      {/* Proof drawer — always rendered, visibility via proofOpen */}
      <div className="no-print">
        <ProofPanel
          proofOpen={bot.proofOpen}
          setProofOpen={bot.setProofOpen}
          playgroundMeta={bot.playgroundMeta}
          playgroundWarnings={bot.playgroundWarnings}
          planData={bot.planData}
          brandSignals={bot.brandSignals}
          brandDiscourseContext={bot.brandDiscourseContext}
          playgroundContext={bot.playgroundContext}
          opportunityContext={bot.opportunityContext}
          audienceInsights={bot.audienceInsights}
          searchInsights={bot.searchInsights}
          audienceUpload={bot.audienceUpload}
          searchUpload={bot.searchUpload}
          selectedPointer={bot.selectedPointer}
          pointerValue={bot.pointerValue}
        />
      </div>
    </div>
  );
}
