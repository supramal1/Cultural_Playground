import {
  generatePlaygroundContext,
  PlaygroundContextRequestSchema
} from "@/lib/playground/perplexityContext";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PlaygroundContextRequestSchema.safeParse(body);
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
    const result = await generatePlaygroundContext(parsed.data);
    return Response.json({
      ok: true,
      context: result.context,
      meta: {
        cache: result.cache,
        version: "v2"
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Playground context generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
