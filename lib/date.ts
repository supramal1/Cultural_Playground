export function toIsoAtMidnight(date: string): string {
  return `${date}T00:00:00.000Z`;
}

export function toIsoAtEndOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

export function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

export function weekLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

export function nowIso(): string {
  return new Date().toISOString();
}
