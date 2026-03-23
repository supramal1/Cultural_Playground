import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import { withConnectorCache } from "@/lib/cache";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

const API_ROOT = "https://app.ticketmaster.com/discovery/v2";
const SOURCE_URL = "https://www.ticketmaster.co.uk/";
const PAGE_SIZE = 200;
const PAGE_LIMIT = 5;

type TicketmasterClassification = {
  segment?: { name?: string };
  genre?: { name?: string };
  subGenre?: { name?: string };
};

type TicketmasterVenue = {
  name?: string;
  city?: { name?: string };
};

type TicketmasterEvent = {
  id: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: {
    start?: {
      dateTime?: string;
      localDate?: string;
    };
    end?: {
      dateTime?: string;
      localDate?: string;
    };
  };
  classifications?: TicketmasterClassification[];
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
};

type TicketmasterEventsResponse = {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalPages?: number;
  };
};

function toIsoStart(input?: { dateTime?: string; localDate?: string }): string | null {
  if (input?.dateTime) {
    const parsed = new Date(input.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (input?.localDate) {
    const parsed = new Date(`${input.localDate}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function toIsoEnd(input?: { dateTime?: string; localDate?: string }): string | undefined {
  if (input?.dateTime) {
    const parsed = new Date(input.dateTime);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (input?.localDate) {
    const parsed = new Date(`${input.localDate}T23:59:59.999Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

export async function collectTicketmasterEvents(
  params: ConnectorParams,
  apiKey: string
): Promise<ConnectorResult> {
  const keyword = (params.keywords || []).map((term) => term.trim()).filter(Boolean).slice(0, 5).join(" ");

  const { payload, cache } = await withConnectorCache({
    connector: "ticketmaster-events",
    params: {
      ...params,
      pageSize: PAGE_SIZE,
      pageLimit: PAGE_LIMIT,
      countryCode: "GB",
      keyword
    },
    keyPresent: Boolean(apiKey),
    forceRefresh: Boolean(params.forceRefresh),
    fetcher: async () => {
      const allEvents: TicketmasterEvent[] = [];
      let totalPages = 1;

      for (let page = 0; page < Math.min(totalPages, PAGE_LIMIT); page += 1) {
        const query = new URLSearchParams({
          apikey: apiKey,
          countryCode: "GB",
          startDateTime: `${params.from}T00:00:00Z`,
          endDateTime: `${params.to}T23:59:59Z`,
          sort: "date,asc",
          size: String(PAGE_SIZE),
          page: String(page)
        });
        if (keyword) {
          query.set("keyword", keyword);
        }
        if (params.city?.trim()) {
          query.set("city", params.city.trim());
        }

        const response = await fetchWithRetry(
          `${API_ROOT}/events.json?${query.toString()}`,
          {
            method: "GET"
          },
          { timeoutMs: 10_000, retries: 2 }
        );

        const json = (await response.json()) as TicketmasterEventsResponse;
        totalPages = json.page?.totalPages || 1;
        allEvents.push(...(json._embedded?.events || []));
      }

      return allEvents;
    }
  });

  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = payload
    .filter((event) => Boolean(event.id && event.name))
    .flatMap((event) => {
      const startDateTime = toIsoStart(event.dates?.start);
      if (!startDateTime) {
        return [];
      }

      const startTime = new Date(startDateTime).getTime();
      if (startTime < fromTime || startTime > toTime) {
        return [];
      }

      const classification = event.classifications?.[0];
      const segment = classification?.segment?.name || "Live event";
      const genre = classification?.genre?.name;
      const subGenre = classification?.subGenre?.name;
      const venue = event._embedded?.venues?.[0];
      const locationName = [venue?.name, venue?.city?.name].filter(Boolean).join(", ") || undefined;
      const description = event.info || event.pleaseNote || "Event from Ticketmaster Discovery API.";
      const tags = ["ticketmaster", segment, genre, subGenre].filter(Boolean) as string[];

      return [
        {
          id: buildMomentId({
            sourceName: "Ticketmaster",
            sourceId: event.id,
            startDateTime,
            title: event.name as string
          }),
          sourceId: event.id,
          title: event.name as string,
          startDateTime,
          endDateTime: toIsoEnd(event.dates?.end),
          timezone: DEFAULT_TIMEZONE,
          region: REGION,
          locationName,
          category: "events" as const,
          subcategory: genre || segment,
          description,
          sourceName: "Ticketmaster",
          sourceUrl: event.url || SOURCE_URL,
          confidence: "medium" as const,
          tags,
          brandSafetyFlags: []
        }
      ];
    });

  return {
    name: "ticketmaster",
    moments,
    cache,
    warnings: []
  };
}
