import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildCacheKey, writeCache, readCache } from "@/lib/cache";

const cacheDir = path.join(process.cwd(), ".cache");

describe("cache utilities", () => {
  beforeAll(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("builds cache keys with key-present state sensitivity", () => {
    const a = buildCacheKey({
      connector: "tmdb",
      params: { from: "2026-01-01", to: "2026-01-31" },
      keyPresent: false,
      version: "v1"
    });

    const b = buildCacheKey({
      connector: "tmdb",
      params: { from: "2026-01-01", to: "2026-01-31" },
      keyPresent: true,
      version: "v1"
    });

    expect(a).not.toEqual(b);
  });

  it("writes and reads cache values", async () => {
    const key = buildCacheKey({
      connector: "holidays",
      params: { from: "2026-01-01", to: "2026-01-10" },
      keyPresent: true,
      version: "v1"
    });

    await writeCache(key, { ok: true }, 60_000);
    const value = await readCache<{ ok: boolean }>(key);

    expect(value).toEqual({ ok: true });
  });
});
