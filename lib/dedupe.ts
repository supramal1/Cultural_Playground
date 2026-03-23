import type { Moment } from "@/lib/schemas/moment";

export function dedupeMoments(moments: Moment[]): Moment[] {
  const bySource = new Map<string, Moment>();

  for (const moment of moments) {
    const key = `${moment.sourceName}|${moment.sourceId}`;
    const existing = bySource.get(key);
    if (!existing) {
      bySource.set(key, moment);
      continue;
    }

    const existingTime = new Date(existing.startDateTime).getTime();
    const incomingTime = new Date(moment.startDateTime).getTime();
    const base = incomingTime < existingTime ? moment : existing;

    bySource.set(key, {
      ...base,
      tags: Array.from(new Set([...(existing.tags || []), ...(moment.tags || [])]))
    });
  }

  return Array.from(bySource.values());
}
