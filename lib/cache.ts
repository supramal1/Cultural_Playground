import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CACHE_TTL_MS, CACHE_VERSION } from "@/lib/config";
import { hashId } from "@/lib/hash";

const CACHE_DIR = process.env.CACHE_DIR
  || (process.env.VERCEL
    ? path.join(tmpdir(), "culture-bot-cache")
    : path.join(process.cwd(), ".cache"));

type CacheEnvelope<T> = {
  createdAt: number;
  ttlMs: number;
  payload: T;
};

export function buildCacheKey(input: {
  connector: string;
  params: Record<string, unknown>;
  keyPresent: boolean;
  version?: string;
}): string {
  const version = input.version || CACHE_VERSION;
  return hashId(
    JSON.stringify({
      connector: input.connector,
      version,
      keyPresent: input.keyPresent,
      params: input.params
    })
  );
}

function cachePathForKey(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await readFile(cachePathForKey(key), "utf-8");
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    const expiresAt = parsed.createdAt + parsed.ttlMs;
    if (Date.now() > expiresAt) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, payload: T, ttlMs = CACHE_TTL_MS): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const envelope: CacheEnvelope<T> = {
    createdAt: Date.now(),
    ttlMs,
    payload
  };
  await writeFile(cachePathForKey(key), JSON.stringify(envelope), "utf-8");
}

export async function withConnectorCache<T>(input: {
  connector: string;
  params: Record<string, unknown>;
  keyPresent: boolean;
  ttlMs?: number;
  forceRefresh?: boolean;
  shouldCache?: (payload: T) => boolean;
  fetcher: () => Promise<T>;
}): Promise<{ payload: T; cache: "hit" | "miss" }> {
  const key = buildCacheKey({
    connector: input.connector,
    params: input.params,
    keyPresent: input.keyPresent
  });
  if (!input.forceRefresh) {
    const cached = await readCache<T>(key);
    if (cached !== null) {
      return { payload: cached, cache: "hit" };
    }
  }

  const payload = await input.fetcher();
  const canCache = input.shouldCache ? input.shouldCache(payload) : true;
  if (canCache) {
    try {
      await writeCache(key, payload, input.ttlMs ?? CACHE_TTL_MS);
    } catch {
      // Cache write failures should not fail the underlying request.
    }
  }
  return { payload, cache: "miss" };
}
