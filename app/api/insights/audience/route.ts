import { InsightsParseError, parseAudienceCsv } from "@/lib/insights/parseAudienceCsv";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  let firstNonEmptyLine = "";
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        ok: false,
        error: {
          code: "INVALID_MULTIPART",
          message: "Invalid multipart form-data body."
        }
      },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "MISSING_FILE",
          message: "Missing file field."
        }
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "FILE_TOO_LARGE",
          message: "File too large. Max 5MB."
        }
      },
      { status: 400 }
    );
  }

  try {
    const text = await file.text();
    firstNonEmptyLine = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)?.slice(0, 240) || "";
    const parsed = parseAudienceCsv(text);
    return Response.json({
      ok: true,
      insights: parsed.insights,
      warnings: parsed.warnings,
      debug: parsed.debug
    });
  } catch (error) {
    if (error instanceof InsightsParseError) {
      return Response.json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message
          },
          debug: error.debug
        },
        { status: 400 }
      );
    }

    return Response.json(
      {
        ok: false,
        error: {
          code: "PARSER_ERROR",
          message: "Audience CSV parsing failed."
        },
        debug: {
          detectedHeaderLine: null,
          parsedRowCount: 0,
          firstNonEmptyLine,
          headerRow: null,
          parseLogTail: error instanceof Error ? error.message.slice(-300) : "Unexpected parser error."
        }
      },
      { status: 400 }
    );
  }
}
