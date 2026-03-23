import { BrandSignalsRequestSchema } from "@/lib/brandSignals/types";
import { generateBrandSignals } from "@/lib/brandSignals/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BrandSignalsRequestSchema.safeParse(body);
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
    const result = await generateBrandSignals(parsed.data);
    return Response.json({
      ok: true,
      brandSignals: result.brandSignals,
      brandDiscourseContext: result.brandDiscourseContext,
      meta: {
        ...result.meta,
        version: "v2"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Brand signals generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
