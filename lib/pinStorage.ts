export const PIN_STORAGE_KEY = "culture-bot:pinned-v1";

export function parsePinnedIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(
      new Set(parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
    );
  } catch {
    return [];
  }
}

export function serializePinnedIds(ids: string[]): string {
  return JSON.stringify(Array.from(new Set(ids.filter((id) => id.trim().length > 0))));
}
