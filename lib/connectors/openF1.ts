import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://api.openf1.org/v1";

type OpenF1Session = {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_key: number;
  circuit_short_name: string;
  country_name: string;
  country_key: number;
  location: string;
  year: number;
  meeting_key: number;
};

export async function collectOpenF1Sessions(params: ConnectorParams): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "openf1-sessions",
    params,
    keyPresent: true,
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const query = new URLSearchParams({
        date_start: `>=${params.from}`,
        date_end: `<=${params.to}T23:59:59Z`,
        session_type: "Race"
      });

      const response = await fetchWithRetry(
        `${API_ROOT}/sessions?${query.toString()}`,
        { method: "GET" },
        { timeoutMs: 10_000, retries: 2 }
      );

      const json = (await response.json()) as OpenF1Session[];
      return Array.isArray(json) ? json : [];
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = payload
    .filter((session) => {
      const sessionTime = new Date(session.date_start).getTime();
      return Number.isFinite(sessionTime) && sessionTime >= fromTime && sessionTime <= toTime;
    })
    .map((session) => {
      const sourceId = `f1-${session.session_key}`;
      const startDateTime = new Date(session.date_start).toISOString();
      const endDateTime = new Date(session.date_end).toISOString();

      return {
        id: buildMomentId({
          sourceName: "openf1",
          sourceId,
          startDateTime,
          title: session.session_name
        }),
        sourceId,
        title: `F1: ${session.circuit_short_name} Grand Prix`,
        startDateTime,
        endDateTime,
        timezone: DEFAULT_TIMEZONE,
        region: REGION,
        category: "sports" as const,
        subcategory: "F1",
        description: `Formula 1 ${session.session_name} at ${session.location}, ${session.country_name}.`,
        sourceName: "openf1",
        sourceUrl: `https://www.formula1.com/en/racing/${session.year}`,
        confidence: "high" as const,
        tags: ["formula-1", "motorsport", session.country_name.toLowerCase()],
        brandSafetyFlags: []
      };
    });

  return {
    name: "openf1-sessions",
    moments,
    cache,
    warnings: []
  };
}
