import { SignalsRequestSchema } from "@/lib/signals/types";
import { generateSignals } from "@/lib/signals/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignalsRequestSchema.safeParse(body);
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

  try {
    const result = await generateSignals(parsed.data);
    return Response.json({
      ok: true,
      signals: result.signals,
      meta: {
        cache: result.cache,
        providers: result.providers
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Signals generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
