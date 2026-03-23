import { MAJOR_SPORTS_CODES } from "@/lib/config";
import type { Moment, ScoredMoment } from "@/lib/schemas/moment";

export type QualityTier = "flagship" | "notable" | "filler";

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function keywordHits(moment: Moment, keywords: string[]): number {
  if (keywords.length === 0) {
    return 0;
  }

  const searchable = [moment.title, moment.description || "", moment.category, moment.subcategory || "", ...moment.tags]
    .join(" ")
    .toLowerCase();

  let hits = 0;
  for (const raw of keywords) {
    const keyword = normalize(raw);
    if (!keyword) {
      continue;
    }
    if (searchable.includes(keyword)) {
      hits += 1;
    }
  }

  return hits;
}

function recencyScore(startDateTime: string, now = new Date()): number {
  const start = new Date(startDateTime);
  const dayDistance = Math.max(
    0,
    Math.floor((start.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );
  // Capped at 40 — proximity informs ranking but doesn't dominate relevance
  return Math.max(0, Math.min(40, Math.round(40 * (1 - dayDistance / 90))));
}

function majorBoost(moment: Moment): number {
  if (moment.category === "holidays") {
    if (moment.tags.map(normalize).includes("bank-holiday")) {
      return 45;
    }
    if (moment.tags.map(normalize).includes("observance")) {
      return 10;
    }
    if (moment.tags.map(normalize).includes("religious-holiday")) {
      return 25;
    }
    if (moment.tags.map(normalize).includes("awareness-day")) {
      return 20;
    }
    return 15;
  }

  if (moment.category === "sports") {
    const code = (moment.subcategory || "").toUpperCase();
    return MAJOR_SPORTS_CODES.has(code) ? 35 : 12;
  }

  if (moment.category === "film") {
    return moment.tags.map(normalize).includes("wide-release-signal") ? 25 : 12;
  }

  if (moment.subcategory === "gaming") {
    return moment.tags.map(normalize).includes("wide-release-signal") ? 25 : 12;
  }

  return 8;
}

function confidenceBoost(moment: Moment): number {
  if (moment.confidence === "high") {
    return 8;
  }
  if (moment.confidence === "medium") {
    return 4;
  }
  return 0;
}

export function qualityTier(moment: Moment): QualityTier {
  if (moment.category === "holidays") {
    if (moment.tags.map(normalize).includes("bank-holiday")) return "flagship";
    if (moment.tags.map(normalize).includes("observance")) return "filler";
    if (moment.tags.map(normalize).includes("religious-holiday")) return "notable";
    if (moment.tags.map(normalize).includes("awareness-day")) return "notable";
    return "notable";
  }

  if (moment.category === "sports") {
    const code = (moment.subcategory || "").toUpperCase();
    return MAJOR_SPORTS_CODES.has(code) ? "flagship" : "notable";
  }

  if (moment.category === "film") {
    return moment.tags.map(normalize).includes("wide-release-signal") ? "flagship" : "notable";
  }

  if (moment.subcategory === "gaming") {
    return moment.tags.map(normalize).includes("wide-release-signal") ? "flagship" : "notable";
  }

  if (moment.confidence === "high") return "notable";
  return "filler";
}

function qualityTierBoostValue(tier: QualityTier): number {
  if (tier === "flagship") return 15;
  if (tier === "notable") return 5;
  return 0;
}

export function scoreBreakdown(moment: Moment, keywords: string[]): {
  proximityBoost: number;
  majorBoost: number;
  keywordBoost: number;
  confidenceBoost: number;
  qualityTierBoost?: number;
} {
  const tier = qualityTier(moment);
  return {
    proximityBoost: recencyScore(moment.startDateTime),
    majorBoost: majorBoost(moment),
    keywordBoost: keywordHits(moment, keywords) * 15,
    confidenceBoost: confidenceBoost(moment),
    qualityTierBoost: qualityTierBoostValue(tier)
  };
}

export function scoreMoment(moment: Moment, keywords: string[]): number {
  const breakdown = scoreBreakdown(moment, keywords);
  return (
    breakdown.proximityBoost +
    breakdown.majorBoost +
    breakdown.keywordBoost +
    breakdown.confidenceBoost +
    (breakdown.qualityTierBoost || 0)
  );
}

export function sortScoredMoments(moments: ScoredMoment[]): ScoredMoment[] {
  return [...moments].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
  });
}

export function applyScores(moments: Moment[], keywords: string[]): ScoredMoment[] {
  return sortScoredMoments(
    moments.map((moment) => {
      const breakdown = scoreBreakdown(moment, keywords);
      return {
        ...moment,
        score:
          breakdown.proximityBoost +
          breakdown.majorBoost +
          breakdown.keywordBoost +
          breakdown.confidenceBoost +
          (breakdown.qualityTierBoost || 0),
        qualityTier: qualityTier(moment),
        scoreBreakdown: breakdown
      };
    })
  );
}
