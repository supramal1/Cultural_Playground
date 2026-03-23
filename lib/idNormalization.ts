function differingCharacterCount(a: string, b: string): number {
  if (a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  let count = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      count += 1;
      if (count > 1) {
        return count;
      }
    }
  }
  return count;
}

export function resolveSingleCharTypoId(id: string, allowedIds: Set<string>): string | null {
  if (allowedIds.has(id)) {
    return id;
  }

  const lower = id.toLowerCase();
  if (allowedIds.has(lower)) {
    return lower;
  }

  const candidates: string[] = [];
  for (const allowed of allowedIds) {
    if (differingCharacterCount(id, allowed) === 1) {
      candidates.push(allowed);
      if (candidates.length > 1) {
        return null;
      }
    }
  }

  return candidates[0] || null;
}
