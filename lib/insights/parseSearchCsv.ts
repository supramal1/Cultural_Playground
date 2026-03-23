import { deriveSearchSeedKeywords } from "@/lib/insights/deriveKeywords";
import { InsightsParseError, type InsightsParseDebug } from "@/lib/insights/parseAudienceCsv";
import {
  SearchInsightsNormalizedSchema,
  type SearchInsightsNormalized
} from "@/lib/insights/types";
import {
  findHeaderRowIndex,
  lookupColumnIndex,
  parseCsvRows,
  parseIsoDate,
  parseMetadataRows,
  parseNumber
} from "@/lib/insights/utils";

function buildDebug(rows: string[][], headerIndex: number, parsedRowCount: number, parseLogTail?: string): InsightsParseDebug {
  const firstNonEmptyLine = rows[0]?.join(", ") || "";
  return {
    detectedHeaderLine: headerIndex >= 0 ? headerIndex + 1 : null,
    parsedRowCount,
    firstNonEmptyLine: firstNonEmptyLine.slice(0, 240),
    headerRow: headerIndex >= 0 ? rows[headerIndex].join(" | ").slice(0, 300) : null,
    parseLogTail
  };
}

function normalizeTrendBucket(trendRaw: string): keyof SearchInsightsNormalized["queriesLatestMonth"]["byTrend"] {
  const normalized = trendRaw.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("fastrising")) {
    return "fastRising";
  }
  if (normalized.includes("sustained")) {
    return "sustainedGrowth";
  }
  if (normalized.includes("emerging")) {
    return "emerging";
  }
  if (normalized.includes("declin")) {
    return "declining";
  }
  return "top";
}

export function parseSearchCsv(csvText: string): {
  insights: SearchInsightsNormalized;
  warnings: string[];
  debug: InsightsParseDebug;
} {
  const warnings: string[] = [];
  const rows = parseCsvRows(csvText);
  const initialDebug = buildDebug(rows, -1, 0, "Search parser initialized.");
  if (rows.length === 0) {
    throw new InsightsParseError("Search CSV is empty.", "EMPTY_FILE", initialDebug);
  }

  const headerIndex = findHeaderRowIndex(rows, ["Month start date", "Item type", "Item"]);
  const debugHeader = buildDebug(rows, headerIndex, 0, "Scanned for required search headers.");
  if (headerIndex < 0) {
    throw new InsightsParseError("Search CSV header not found.", "HEADER_NOT_FOUND", debugHeader);
  }

  const headers = rows[headerIndex];
  const metadata = parseMetadataRows(rows, headerIndex);

  const monthIdx = lookupColumnIndex(headers, ["Month start date"]);
  const itemTypeIdx = lookupColumnIndex(headers, ["Item type"]);
  const itemIdx = lookupColumnIndex(headers, ["Item"]);
  const trendIdx = lookupColumnIndex(headers, ["Query trend"]);
  const indexedSearchIdx = lookupColumnIndex(headers, ["Indexed searches"]);
  const monthlyVolumeIdx = lookupColumnIndex(headers, ["Monthly search volume"]);
  const yoyIdx = lookupColumnIndex(headers, ["YoY Growth for total searches"]);
  const momIdx = lookupColumnIndex(headers, ["MoM Growth for total searches"]);

  if (monthIdx < 0 || itemTypeIdx < 0 || itemIdx < 0) {
    throw new InsightsParseError(
      "Search CSV missing required columns.",
      "MISSING_REQUIRED_COLUMNS",
      buildDebug(rows, headerIndex, 0, "Detected header but one or more required columns are missing.")
    );
  }

  const timeSeries: SearchInsightsNormalized["timeSeries"] = [];
  const queryRows: Array<{
    monthStart: string;
    query: string;
    trend: string;
    indexedSearches: number | null;
    monthlySearchVolume: number | null;
  }> = [];
  let parsedRowCount = 0;

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const monthStart = parseIsoDate(row[monthIdx]);
    const itemType = row[itemTypeIdx]?.trim().toLowerCase();
    const item = row[itemIdx]?.trim();

    if (!monthStart || !itemType || !item) {
      continue;
    }
    parsedRowCount += 1;

    if (itemType.includes("category(indexed)")) {
      timeSeries.push({
        monthStart,
        indexedSearches: indexedSearchIdx >= 0 ? parseNumber(row[indexedSearchIdx]) : null,
        momGrowth: momIdx >= 0 ? parseNumber(row[momIdx]) : null,
        yoyGrowth: yoyIdx >= 0 ? parseNumber(row[yoyIdx]) : null
      });
      continue;
    }

    if (itemType !== "query") {
      continue;
    }

    const trend = trendIdx >= 0 && row[trendIdx] ? row[trendIdx] : "Top";
    queryRows.push({
      monthStart,
      query: item,
      trend,
      indexedSearches: indexedSearchIdx >= 0 ? parseNumber(row[indexedSearchIdx]) : null,
      monthlySearchVolume: monthlyVolumeIdx >= 0 ? parseNumber(row[monthlyVolumeIdx]) : null
    });
  }

  if (timeSeries.length === 0) {
    warnings.push("No indexed time series rows found in search insights CSV.");
  }

  const latestMonth = queryRows
    .map((row) => row.monthStart)
    .sort((a, b) => (a < b ? 1 : -1))[0];
  if (!latestMonth) {
    throw new InsightsParseError(
      "Search insights CSV did not contain query rows.",
      "NO_QUERY_ROWS",
      buildDebug(rows, headerIndex, parsedRowCount, "No latest-month query rows found.")
    );
  }

  const latestQueries = queryRows.filter((row) => row.monthStart === latestMonth);
  const byTrend: SearchInsightsNormalized["queriesLatestMonth"]["byTrend"] = {
    top: [],
    fastRising: [],
    sustainedGrowth: [],
    emerging: [],
    declining: []
  };

  for (const row of latestQueries) {
    const bucket = normalizeTrendBucket(row.trend);
    byTrend[bucket].push({
      query: row.query,
      trend: row.trend,
      indexedSearches: row.indexedSearches,
      monthlySearchVolume: row.monthlySearchVolume
    });
  }

  const seedKeywords = deriveSearchSeedKeywords(byTrend);
  if (seedKeywords.length === 0 && latestQueries.length > 0) {
    warnings.push("Latest-month search queries were parsed but produced no usable seed keywords.");
  }

  const parsed = SearchInsightsNormalizedSchema.safeParse({
    meta: {
      downloadDate: metadata["download date"],
      location: metadata["location"],
      timeFrame: metadata["time frame"],
      topic: metadata["topic"]
    },
    timeSeries: timeSeries.sort((a, b) => (a.monthStart < b.monthStart ? -1 : 1)),
    queriesLatestMonth: {
      monthStart: latestMonth,
      byTrend
    },
    derived: {
      seedKeywords,
      negativeKeywords: []
    }
  });

  if (!parsed.success) {
    throw new InsightsParseError(
      `Search insights normalization failed: ${parsed.error.issues[0]?.message}`,
      "NORMALIZATION_FAILED",
      buildDebug(rows, headerIndex, parsedRowCount, parsed.error.issues[0]?.message)
    );
  }

  return {
    insights: parsed.data,
    warnings,
    debug: buildDebug(rows, headerIndex, parsedRowCount, warnings.join(" | ").slice(-300))
  };
}
