import { deriveAudienceSeedKeywords } from "@/lib/insights/deriveKeywords";
import {
  AudienceInsightsNormalizedSchema,
  type AudienceInsightsNormalized
} from "@/lib/insights/types";
import {
  findHeaderRowIndex,
  lookupColumnIndex,
  parseCsvRows,
  parseMetadataRows,
  parseNumber
} from "@/lib/insights/utils";

export type InsightsParseDebug = {
  detectedHeaderLine: number | null;
  parsedRowCount: number;
  firstNonEmptyLine: string;
  headerRow: string | null;
  parseLogTail?: string;
};

export class InsightsParseError extends Error {
  readonly code: string;
  readonly debug: InsightsParseDebug;

  constructor(message: string, code: string, debug: InsightsParseDebug) {
    super(message);
    this.name = "InsightsParseError";
    this.code = code;
    this.debug = debug;
  }
}

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

export function parseAudienceCsv(csvText: string): {
  insights: AudienceInsightsNormalized;
  warnings: string[];
  debug: InsightsParseDebug;
} {
  const warnings: string[] = [];
  const rows = parseCsvRows(csvText);
  const initialDebug = buildDebug(rows, -1, 0, "Audience parser initialized.");
  if (rows.length === 0) {
    throw new InsightsParseError("Audience CSV is empty.", "EMPTY_FILE", initialDebug);
  }

  const headerIndex = findHeaderRowIndex(rows, ["Area", "Sub Area", "Item", "Share"]);
  const debugHeader = buildDebug(rows, headerIndex, 0, "Scanned for required audience headers.");
  if (headerIndex < 0) {
    throw new InsightsParseError("Audience CSV header not found.", "HEADER_NOT_FOUND", debugHeader);
  }

  const headers = rows[headerIndex];
  const metadata = parseMetadataRows(rows, headerIndex);
  const areaIdx = lookupColumnIndex(headers, ["Area"]);
  const subAreaIdx = lookupColumnIndex(headers, ["Sub Area"]);
  const itemIdx = lookupColumnIndex(headers, ["Item"]);
  const shareIdx = lookupColumnIndex(headers, ["Share"]);
  const baselineShareIdx = lookupColumnIndex(headers, ["Baseline share"]);
  const indexIdx = lookupColumnIndex(headers, ["Index"]);
  const relevanceIdx = lookupColumnIndex(headers, ["Relevance"]);
  const urlIdx = lookupColumnIndex(headers, ["URL"]);

  if (areaIdx < 0 || subAreaIdx < 0 || itemIdx < 0) {
    throw new InsightsParseError(
      "Audience CSV missing required columns.",
      "MISSING_REQUIRED_COLUMNS",
      buildDebug(rows, headerIndex, 0, "Detected header but one or more required columns are missing.")
    );
  }

  const gender: AudienceInsightsNormalized["composition"]["gender"] = [];
  const age: AudienceInsightsNormalized["composition"]["age"] = [];
  const topAffinities: AudienceInsightsNormalized["topAffinities"] = [];
  let parsedRowCount = 0;

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const area = row[areaIdx]?.trim();
    const subArea = row[subAreaIdx]?.trim();
    const item = row[itemIdx]?.trim();
    if (!area || !subArea || !item) {
      continue;
    }
    parsedRowCount += 1;

    const share = shareIdx >= 0 ? parseNumber(row[shareIdx]) : null;
    const baselineShare = baselineShareIdx >= 0 ? parseNumber(row[baselineShareIdx]) : null;
    const index = indexIdx >= 0 ? parseNumber(row[indexIdx]) : null;
    const relevance = relevanceIdx >= 0 ? parseNumber(row[relevanceIdx]) : null;

    if (area.toLowerCase() === "composition") {
      const compositionRow = {
        label: item,
        share,
        baselineShare,
        index,
        relevance
      };
      if (subArea.toLowerCase() === "gender") {
        gender.push(compositionRow);
        continue;
      }
      if (subArea.toLowerCase() === "age") {
        age.push(compositionRow);
        continue;
      }
      if (subArea.toLowerCase() === "location") {
        continue;
      }
      // Affinity, In-market segments, and other sub-areas fall through
      // to topAffinities below
    }

    topAffinities.push({
      area,
      subArea,
      item,
      index,
      share,
      relevance,
      url: urlIdx >= 0 ? row[urlIdx] || undefined : undefined
    });
  }

  const affinityPool = topAffinities.length > 0 ? topAffinities : [];
  const seedKeywords = deriveAudienceSeedKeywords(affinityPool);
  if (seedKeywords.length === 0 && topAffinities.length > 0) {
    warnings.push("Audience affinities were parsed but produced no usable seed keywords.");
  }

  const parsed = AudienceInsightsNormalizedSchema.safeParse({
    meta: {
      downloadDate: metadata["download date"],
      location: metadata["location"],
      timeFrame: metadata["time frame"],
      topic: metadata["topic"],
      audience: metadata["audience"],
      baselineAudience: metadata["baseline audience"]
    },
    composition: {
      gender: gender.length > 0 ? gender : undefined,
      age: age.length > 0 ? age : undefined
    },
    topAffinities,
    derived: {
      seedKeywords,
      exclusions: []
    }
  });

  if (!parsed.success) {
    throw new InsightsParseError(
      `Audience insights normalization failed: ${parsed.error.issues[0]?.message}`,
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
