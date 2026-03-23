import { describe, expect, it } from "vitest";
import { parsePinnedIds, serializePinnedIds } from "@/lib/pinStorage";

describe("pin storage", () => {
  it("parses valid pinned ids and removes duplicates", () => {
    expect(parsePinnedIds('["a","b","a",""]')).toEqual(["a", "b"]);
  });

  it("handles malformed storage payload", () => {
    expect(parsePinnedIds("not-json")).toEqual([]);
  });

  it("serializes pinned ids uniquely", () => {
    expect(serializePinnedIds(["x", "x", "y"])).toBe('["x","y"]');
  });
});
