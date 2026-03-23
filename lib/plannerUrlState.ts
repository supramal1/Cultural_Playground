export type UrlSortMode = "relevance" | "date" | "confidence";
export type UrlConfidenceFilter = "all" | "high";
export type UrlCategory = "sports" | "film" | "holidays" | "events";

export type PlannerUrlState = {
  from?: string;
  to?: string;
  categories?: UrlCategory[];
  brand?: string;
  boost?: string;
  audience?: string;
  sort?: UrlSortMode;
  planner?: boolean;
  confidence?: UrlConfidenceFilter;
  weekendsOnly?: boolean;
  pin?: string[];
};

const URL_CATEGORIES: UrlCategory[] = ["sports", "film", "holidays", "events"];
const URL_SORTS: UrlSortMode[] = ["relevance", "date", "confidence"];
const URL_CONFIDENCE: UrlConfidenceFilter[] = ["all", "high"];

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parsePlannerUrlState(search: string): PlannerUrlState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const parsed: PlannerUrlState = {};

  const from = params.get("from");
  if (from && isIsoDate(from)) {
    parsed.from = from;
  }

  const to = params.get("to");
  if (to && isIsoDate(to)) {
    parsed.to = to;
  }

  const categoriesRaw = params.get("categories");
  if (categoriesRaw) {
    const categories = categoriesRaw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is UrlCategory => URL_CATEGORIES.includes(value as UrlCategory));
    if (categories.length > 0) {
      parsed.categories = Array.from(new Set(categories));
    }
  }

  const boost = params.get("boost");
  if (typeof boost === "string") {
    parsed.boost = boost;
  }

  const brand = params.get("brand");
  if (typeof brand === "string") {
    parsed.brand = brand;
  }

  const audience = params.get("audience");
  if (typeof audience === "string") {
    parsed.audience = audience;
  }

  const sort = params.get("sort");
  if (sort && URL_SORTS.includes(sort as UrlSortMode)) {
    parsed.sort = sort as UrlSortMode;
  }

  const planner = params.get("planner");
  parsed.planner = planner === "1";

  const confidence = params.get("confidence");
  if (confidence && URL_CONFIDENCE.includes(confidence as UrlConfidenceFilter)) {
    parsed.confidence = confidence as UrlConfidenceFilter;
  }

  parsed.weekendsOnly = params.get("weekends") === "1";

  const pin = params.get("pin");
  if (pin) {
    parsed.pin = Array.from(
      new Set(
        pin
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
  }

  return parsed;
}

export function buildPlannerUrlSearch(input: PlannerUrlState): string {
  const params = new URLSearchParams();

  if (input.from) {
    params.set("from", input.from);
  }
  if (input.to) {
    params.set("to", input.to);
  }
  if (input.categories && input.categories.length > 0) {
    params.set("categories", Array.from(new Set(input.categories)).join(","));
  }
  if (typeof input.boost === "string") {
    params.set("boost", input.boost);
  }
  if (typeof input.brand === "string" && input.brand.trim()) {
    params.set("brand", input.brand.trim());
  }
  if (typeof input.audience === "string" && input.audience.trim()) {
    params.set("audience", input.audience.trim());
  }
  if (input.sort) {
    params.set("sort", input.sort);
  }
  if (input.planner) {
    params.set("planner", "1");
  }
  if (input.confidence === "high") {
    params.set("confidence", "high");
  }
  if (input.weekendsOnly) {
    params.set("weekends", "1");
  }
  if (input.pin && input.pin.length > 0) {
    params.set("pin", Array.from(new Set(input.pin)).join(","));
  }

  const search = params.toString();
  return search ? `?${search}` : "";
}
