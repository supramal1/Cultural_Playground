import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/signals/route";

describe("/api/signals route", () => {
  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost/api/signals", {
      method: "POST",
      body: "{"
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns ok response with providers disabled", async () => {
    const request = new Request("http://localhost/api/signals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        keywords: ["Arsenal", "Marvel"],
        includeGoogleTrends: false,
        includeReddit: false,
        includeWikimedia: false
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = (await response.json()) as {
      ok: boolean;
      signals: { meta: { inputs: { keywords: string[] } } };
    };

    expect(json.ok).toBe(true);
    expect(json.signals.meta.inputs.keywords.length).toBeGreaterThan(0);
  });
});
