import { synthesizeMoments, SynthesizeRequestSchema } from "@/lib/synthesisService";
import {
  synthesizePlanDataV2,
  SynthesizeV2RequestSchema
} from "@/lib/synthesisServiceV2";
import {
  synthesizeBlueprint,
  synthesizeMediaOwnerBrief
} from "@/lib/briefBuilder/service";
import {
  SynthesizeBlueprintRequestSchema,
  SynthesizeBriefRequestSchema
} from "@/lib/briefBuilder/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error: "OPENAI_API_KEY is required for synthesis"
      },
      { status: 400 }
    );
  }

  try {
    const asV2 = body as { version?: string; schemaVersion?: number; mode?: string };
    const wantsV2 = asV2?.version === "v2" || asV2?.schemaVersion === 2;
    if (wantsV2) {
      if (asV2.mode === "blueprint") {
        const parsedBlueprint = SynthesizeBlueprintRequestSchema.safeParse(body);
        if (!parsedBlueprint.success) {
          return Response.json(
            {
              error: "Invalid request body",
              details: parsedBlueprint.error.flatten()
            },
            { status: 400 }
          );
        }

        const blueprint = await synthesizeBlueprint(parsedBlueprint.data);
        return Response.json({
          blueprint: blueprint.blueprint,
          meta: {
            version: "v2",
            mode: "blueprint",
            warnings: blueprint.warnings
          }
        });
      }

      if (asV2.mode === "brief") {
        const parsedBrief = SynthesizeBriefRequestSchema.safeParse(body);
        if (!parsedBrief.success) {
          return Response.json(
            {
              error: "Invalid request body",
              details: parsedBrief.error.flatten()
            },
            { status: 400 }
          );
        }

        const brief = await synthesizeMediaOwnerBrief(parsedBrief.data);
        return Response.json({
          brief: brief.brief,
          meta: {
            version: "v2",
            mode: "brief",
            warnings: brief.warnings
          }
        });
      }

      const parsedV2 = SynthesizeV2RequestSchema.safeParse(body);
      if (!parsedV2.success) {
        return Response.json(
          {
            error: "Invalid request body",
            details: parsedV2.error.flatten()
          },
          { status: 400 }
        );
      }

      const v2 = await synthesizePlanDataV2(parsedV2.data);
      return Response.json({
        synthesis: v2.synthesis,
        meta: {
          version: "v2",
          warnings: v2.warnings
        }
      });
    }

    const parsed = SynthesizeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten()
        },
        { status: 400 }
      );
    }

    const result = await synthesizeMoments(parsed.data);
    return Response.json({
      ...result,
      meta: {
        version: "v1"
      }
    });
  } catch (error) {
    const err = error as Error & {
      invalidIds?: string[];
      allowedIds?: string[];
      invalidPointers?: string[];
      allowedPointers?: string[];
      proofFailure?: {
        reasons?: string[];
        audienceSignalsUsedCount?: number;
        searchSignalsUsedCount?: number;
        signalsUsedCount?: number;
        evidenceCount?: number;
      };
      details?: { reasons?: string[] };
    };
    if (err.invalidIds && err.allowedIds) {
      return Response.json(
        {
          error: "Synthesis validation failed",
          details: {
            invalidIds: err.invalidIds,
            allowedIds: err.allowedIds
          }
        },
        { status: 422 }
      );
    }

    if (err.invalidPointers && err.allowedPointers) {
      return Response.json(
        {
          error: "Synthesis evidence validation failed",
          details: {
            invalidPointers: err.invalidPointers,
            allowedPointers: err.allowedPointers
          }
        },
        { status: 422 }
      );
    }

    if (err.proofFailure || err.details?.reasons) {
      return Response.json(
        {
          error: "Proof-of-use failed",
          details: {
            reasons: err.details?.reasons || err.proofFailure?.reasons || [],
            audienceSignalsUsedCount: err.proofFailure?.audienceSignalsUsedCount || 0,
            searchSignalsUsedCount: err.proofFailure?.searchSignalsUsedCount || 0,
            signalsUsedCount: err.proofFailure?.signalsUsedCount || 0,
            evidenceCount: err.proofFailure?.evidenceCount || 0
          }
        },
        { status: 422 }
      );
    }

    return Response.json(
      {
        error: "Synthesis failed",
        details: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
