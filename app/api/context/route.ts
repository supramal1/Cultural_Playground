import { ContextRequestSchema, generateExternalContext } from "@/lib/contextService";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ContextRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid request body",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  if (!process.env.PERPLEXITY_API_KEY) {
    return Response.json(
      {
        error: "PERPLEXITY_API_KEY is required for external context"
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateExternalContext(parsed.data);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: "External context generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
