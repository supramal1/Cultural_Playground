/**
 * Shared text normalisation utilities used by engine, keywordStrategy, and scoring.
 */

export function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function singularize(value: string): string {
  if (value.length <= 3) {
    return value;
  }
  if (value.endsWith("ies")) {
    return value.slice(0, -3) + "y";
  }
  if (value.endsWith("sses")) {
    return value.slice(0, -2);
  }
  if (value.endsWith("ses") || value.endsWith("zes") || value.endsWith("xes") || value.endsWith("ches") || value.endsWith("shes")) {
    return value.slice(0, -2);
  }
  if (value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
  return value;
}

export function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => singularize(token))
    .filter((token) => token.length >= 2);
}
