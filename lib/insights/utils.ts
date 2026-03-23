const META_LINE_PREFIX = "#";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCell(value: string): string {
  let next = value.trim();
  if (next.startsWith("\"") && next.endsWith("\"")) {
    next = next.slice(1, -1);
  }
  return normalizeWhitespace(next);
}

export function normalizeHeader(value: string): string {
  return normalizeCell(value).toLowerCase();
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      const normalizedRow = row.map(normalizeCell);
      if (normalizedRow.some((value) => value.length > 0)) {
        rows.push(normalizedRow);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    const normalizedRow = row.map(normalizeCell);
    if (normalizedRow.some((value) => value.length > 0)) {
      rows.push(normalizedRow);
    }
  }

  return rows;
}

export function findHeaderRowIndex(rows: string[][], expectedHeaders: string[]): number {
  const expected = expectedHeaders.map(normalizeHeader);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex].map(normalizeHeader);
    const hasAll = expected.every((header) => row.includes(header));
    if (hasAll) {
      return rowIndex;
    }
  }

  return -1;
}

export function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const raw = normalizeCell(value).toLowerCase();
  if (!raw || raw === "n/a" || raw === "na" || raw === "null" || raw === "-") {
    return null;
  }

  const isPercent = raw.includes("%");
  const normalized = raw.replaceAll(",", "").replace("%", "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (isPercent) {
    return parsed / 100;
  }

  return parsed;
}

export function parseIsoDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  const direct = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  if (direct) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

export function parseMetadataRows(rows: string[][], untilRowIndex: number): Record<string, string> {
  const metadata: Record<string, string> = {};

  for (let i = 0; i < untilRowIndex; i += 1) {
    const joined = normalizeWhitespace(rows[i].join(" "));
    if (!joined) {
      continue;
    }

    const withoutPrefix = joined.startsWith(META_LINE_PREFIX)
      ? normalizeWhitespace(joined.slice(1))
      : joined;
    if (!withoutPrefix) {
      continue;
    }

    const separatorIndex = withoutPrefix.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizeWhitespace(withoutPrefix.slice(0, separatorIndex)).toLowerCase();
    const value = normalizeWhitespace(withoutPrefix.slice(separatorIndex + 1));
    if (!key || !value) {
      continue;
    }
    metadata[key] = value;
  }

  return metadata;
}

export function lookupColumnIndex(headers: string[], nameOptions: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const name of nameOptions) {
    const idx = normalizedHeaders.indexOf(normalizeHeader(name));
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}
