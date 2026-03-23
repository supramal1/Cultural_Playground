export const REGION = "UK";
export const DEFAULT_TIMEZONE = "Europe/London";

export const CACHE_VERSION = "v1";
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const MAX_DATE_RANGE_DAYS = 90;
export const SYNTHESIS_TOP_N = 80;

export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const LLM_RELEVANCE_MAX_MOMENTS = 120;
export const LLM_RELEVANCE_WEIGHT = 0.8;
export const LLM_KEYWORD_RELEVANCE_MIN = 40;
export const LLM_KEYWORD_MIN_KEEP = 20;

export const V1_SPORTS_COMPETITIONS = [
  { code: "PL", name: "Premier League", major: true },
  { code: "CL", name: "UEFA Champions League", major: true },
  { code: "EL", name: "UEFA Europa League", major: true },
  { code: "EC", name: "UEFA Conference League", major: false },
  { code: "F1", name: "Formula 1", major: true }
] as const;

export const MAJOR_SPORTS_CODES: Set<string> = new Set(
  V1_SPORTS_COMPETITIONS.filter((c) => c.major).map((c) => c.code)
);

export const RAPIDAPI_FOOTBALL_DEFAULT_HOST = "free-api-live-football-data.p.rapidapi.com";
export const RAPIDAPI_MAX_REQUESTS_PER_SEARCH = 10;

export const RAPIDAPI_LEAGUE_IDS_BY_CODE: Record<string, number> = {
  PL: 47,
  CL: 42,
  EL: 73,
  EC: 10216
};

export const MAX_MOMENTS_TO_BUILD = 8;
export const MAX_OPPORTUNITY_CONTEXT_MOMENTS = 5;

export const ALL_CATEGORIES = ["sports", "film", "holidays", "events"] as const;
