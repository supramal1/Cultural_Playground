import { generateSlide, SlideRequestSchema } from "@/lib/slideService";
import { generateSlideV2, SlideV2RequestSchema } from "@/lib/slideServiceV2";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const asV2 = body as { version?: string; schemaVersion?: number };
    const wantsV2 = asV2?.version === "v2" || asV2?.schemaVersion === 2;
    if (wantsV2) {
      const parsedV2 = SlideV2RequestSchema.safeParse(body);
      if (!parsedV2.success) {
        return Response.json(
          {
            error: "Invalid request body",
            details: parsedV2.error.flatten()
          },
          { status: 400 }
        );
      }

      const result = generateSlideV2(parsedV2.data);
      return Response.json({
        ...result,
        meta: {
          version: "v2"
        }
      });
    }

    const parsed = SlideRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error: "OPENAI_API_KEY is required for slide generation"
        },
        { status: 400 }
      );
    }

    const result = await generateSlide(parsed.data);
    return Response.json({
      ...result,
      meta: {
        version: "v1"
      }
    });
  } catch (error) {
    const err = error as Error & { invalidIds?: string[]; allowedIds?: string[] };
    if (err.invalidIds && err.allowedIds) {
      return Response.json(
        {
          error: "Slide validation failed",
          details: {
            invalidIds: err.invalidIds,
            allowedIds: err.allowedIds
          }
        },
        { status: 422 }
      );
    }

    return Response.json(
      {
        error: "Slide generation failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
