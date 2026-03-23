/**
 * Translates raw signal values into human-readable scale labels
 * for planners who don't know whether 50K wiki pageviews is a lot or a little.
 */

export function wikiScale(totalPageviews: number): string {
  if (totalPageviews >= 500_000) return "mass attention";
  if (totalPageviews >= 50_000) return "high attention";
  if (totalPageviews >= 5_000) return "moderate attention";
  return "niche";
}

export function trendsScale(risingValue: number): string {
  if (risingValue >= 500) return "breakout";
  if (risingValue >= 100) return "rising";
  return "early signal";
}

export function redditScale(score: number): string {
  if (score >= 1_000) return "viral";
  if (score >= 100) return "active discussion";
  return "niche";
}

export function signalScaleSummary(input: {
  wikiEntities?: Array<{ title: string; total: number }> | null;
  trendsQueries?: Array<{ query: string; value?: number | null; type?: string }> | null;
  redditPosts?: Array<{ title: string; score?: number | null }> | null;
  guardianArticles?: Array<{ title: string; section: string }> | null;
}): string[] {
  const bullets: string[] = [];

  const topWiki = (input.wikiEntities || []).slice(0, 3);
  for (const entity of topWiki) {
    bullets.push(
      `${entity.title}: ${wikiScale(entity.total)} (${entity.total.toLocaleString()} pageviews)`
    );
  }

  const risingTrends = (input.trendsQueries || [])
    .filter((q) => q.type === "rising")
    .slice(0, 3);
  for (const trend of risingTrends) {
    const val = trend.value ?? 0;
    bullets.push(`"${trend.query}": ${trendsScale(val)} (${val})`);
  }

  const topPosts = (input.redditPosts || []).slice(0, 2);
  for (const post of topPosts) {
    const score = post.score ?? 0;
    const title = post.title.length > 60 ? post.title.slice(0, 57) + "..." : post.title;
    bullets.push(`Reddit: "${title}" — ${redditScale(score)} (score ${score})`);
  }

  const guardianItems = (input.guardianArticles || []).slice(0, 3);
  if (guardianItems.length > 0) {
    const sections = [...new Set(guardianItems.map((a) => a.section))];
    bullets.push(`Guardian: ${guardianItems.length} articles across ${sections.join(", ")}`);
  }

  return bullets;
}
