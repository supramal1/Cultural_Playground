import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const ENDPOINT = "https://www.gov.uk/bank-holidays.json";
const SOURCE_URL = "https://www.gov.uk/bank-holidays";

type GovUkEvent = {
  title: string;
  date: string;
  notes: string;
  bunting: boolean;
};

type GovUkSection = {
  division: string;
  events: GovUkEvent[];
};

type GovUkResponse = Record<string, GovUkSection>;

export async function collectGovUkBankHolidays(params: ConnectorParams): Promise<ConnectorResult> {
  const { payload, cache } = await withConnectorCache({
    connector: "govuk-bank-holidays",
    params,
    keyPresent: true,
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const response = await fetchWithRetry(
        ENDPOINT,
        {
          method: "GET"
        },
        { timeoutMs: 10_000, retries: 2 }
      );
      const json = (await response.json()) as GovUkResponse;
      return json;
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = Object.entries(payload).flatMap(([sectionKey, section]) => {
    return section.events
      .filter((event) => {
        const time = new Date(`${event.date}T00:00:00.000Z`).getTime();
        return time >= fromTime && time <= toTime;
      })
      .map((event) => {
        const sourceId = `${sectionKey}|${event.title}|${event.date}`;
        const tags = [event.bunting ? "bank-holiday" : "observance", sectionKey];
        const startDateTime = `${event.date}T00:00:00.000Z`;
        return {
          id: buildMomentId({
            sourceName: "gov-uk",
            sourceId,
            startDateTime,
            title: event.title
          }),
          sourceId,
          title: event.title,
          startDateTime,
          timezone: DEFAULT_TIMEZONE,
          region: REGION,
          category: "holidays" as const,
          subcategory: event.bunting ? "bank-holiday" : "observance",
          description: event.notes || "UK calendar moment from GOV.UK bank holidays feed.",
          sourceName: "gov-uk",
          sourceUrl: SOURCE_URL,
          confidence: "high" as const,
          tags,
          brandSafetyFlags: []
        };
      });
  });

  return {
    name: "gov-uk-holidays",
    moments,
    cache,
    warnings: []
  };
}
