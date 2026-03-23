import { buildPlanDataCached } from "@/lib/playground/engine";
import { PlanDataRequestSchema } from "@/lib/playground/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PlanDataRequestSchema.safeParse(body);
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
    const planData = await buildPlanDataCached(data, forceRefresh);
    return Response.json({
      ok: true,
      planData,
      meta: {
        version: "v2"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Plan data generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}

