import {
  PlaygroundDiscoveryRequestSchema
} from "@/lib/playground/types";
import { discoverPlaygroundsCached } from "@/lib/playground/engine";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PlaygroundDiscoveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid request body",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const url = new URL(request.url);
  const refreshParam = url.searchParams.get("refresh");
  const forceRefresh =
    data.options?.refresh === true || refreshParam === "1" || refreshParam === "true";

  try {
    const result = await discoverPlaygroundsCached(data, forceRefresh);
    return Response.json({
      ok: true,
      candidates: result.candidates,
      meta: {
        ...result.meta,
        version: "v2"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Playground discovery failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}

