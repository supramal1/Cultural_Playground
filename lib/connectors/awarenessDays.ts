import { DEFAULT_TIMEZONE, REGION } from "@/lib/config";
import type { ConnectorParams, ConnectorResult } from "@/lib/connectors/types";
import { buildMomentId } from "@/lib/schemas/moment";

type AwarenessEntry = {
  title: string;
  dates: Array<{ year: number; month: number; day: number }>;
  tags: string[];
  description: string;
  confidence: "high" | "medium";
  sourceUrl: string;
};

/**
 * UK awareness days, cultural holidays, and religious observances.
 * Variable-date events are listed with their computed dates for 2025 and 2026.
 */
const AWARENESS_CALENDAR: AwarenessEntry[] = [
  // --- Monthly awareness events (use first day of month) ---
  { title: "Dry January", dates: [{ year: 2025, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 }], tags: ["awareness-day", "health", "alcohol-free"], description: "Month-long abstinence from alcohol. Major participation moment for health/wellness brands.", confidence: "high", sourceUrl: "https://alcoholchange.org.uk/get-involved/campaigns/dry-january" },
  { title: "Veganuary", dates: [{ year: 2025, month: 1, day: 1 }, { year: 2026, month: 1, day: 1 }], tags: ["awareness-day", "food", "vegan"], description: "Month-long pledge to eat vegan. Major CPG and food-service moment.", confidence: "high", sourceUrl: "https://veganuary.com/" },
  { title: "LGBT History Month UK", dates: [{ year: 2025, month: 2, day: 1 }, { year: 2026, month: 2, day: 1 }], tags: ["awareness-day", "diversity", "lgbtq"], description: "UK celebrates LGBT history throughout February.", confidence: "high", sourceUrl: "https://lgbtplushistorymonth.co.uk/" },
  { title: "Pride Month", dates: [{ year: 2025, month: 6, day: 1 }, { year: 2026, month: 6, day: 1 }], tags: ["awareness-day", "diversity", "lgbtq", "pride"], description: "Global celebration of LGBTQ+ identity, rights, and culture.", confidence: "high", sourceUrl: "https://www.prideinlondon.org/" },
  { title: "Black History Month UK", dates: [{ year: 2025, month: 10, day: 1 }, { year: 2026, month: 10, day: 1 }], tags: ["awareness-day", "diversity", "culture"], description: "UK celebrates Black history, culture, and contributions throughout October.", confidence: "high", sourceUrl: "https://www.blackhistorymonth.org.uk/" },
  { title: "Stoptober", dates: [{ year: 2025, month: 10, day: 1 }, { year: 2026, month: 10, day: 1 }], tags: ["awareness-day", "health", "smoking"], description: "NHS-backed campaign encouraging smokers to quit for 28 days.", confidence: "high", sourceUrl: "https://www.nhs.uk/better-health/quit-smoking/" },
  { title: "Movember", dates: [{ year: 2025, month: 11, day: 1 }, { year: 2026, month: 11, day: 1 }], tags: ["awareness-day", "health", "mens-health"], description: "Month-long campaign for men's health awareness. Major grooming/wellness brand moment.", confidence: "high", sourceUrl: "https://movember.com/" },

  // --- Fixed-date events ---
  { title: "Valentine's Day", dates: [{ year: 2025, month: 2, day: 14 }, { year: 2026, month: 2, day: 14 }], tags: ["cultural-holiday", "relationships", "gifting"], description: "Major retail and gifting cultural moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Valentine%27s_Day" },
  { title: "International Women's Day", dates: [{ year: 2025, month: 3, day: 8 }, { year: 2026, month: 3, day: 8 }], tags: ["awareness-day", "diversity", "gender"], description: "Global day celebrating women's achievements and gender equality.", confidence: "high", sourceUrl: "https://www.internationalwomensday.com/" },
  { title: "St Patrick's Day", dates: [{ year: 2025, month: 3, day: 17 }, { year: 2026, month: 3, day: 17 }], tags: ["cultural-holiday", "irish", "celebration"], description: "Irish cultural celebration, widely observed in UK.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Saint_Patrick%27s_Day" },
  { title: "Earth Day", dates: [{ year: 2025, month: 4, day: 22 }, { year: 2026, month: 4, day: 22 }], tags: ["awareness-day", "environment", "sustainability"], description: "Global environmental awareness day.", confidence: "high", sourceUrl: "https://www.earthday.org/" },
  { title: "Vaisakhi", dates: [{ year: 2025, month: 4, day: 14 }, { year: 2026, month: 4, day: 14 }], tags: ["religious-holiday", "sikh", "cultural"], description: "Sikh new year and harvest festival. Major cultural celebration in UK.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Vaisakhi" },
  { title: "World Environment Day", dates: [{ year: 2025, month: 6, day: 5 }, { year: 2026, month: 6, day: 5 }], tags: ["awareness-day", "environment", "sustainability"], description: "UN-led global awareness day for environmental action.", confidence: "high", sourceUrl: "https://www.worldenvironmentday.global/" },
  { title: "Windrush Day", dates: [{ year: 2025, month: 6, day: 22 }, { year: 2026, month: 6, day: 22 }], tags: ["awareness-day", "diversity", "culture", "heritage"], description: "Celebrates the Windrush generation's contribution to British life.", confidence: "high", sourceUrl: "https://www.gov.uk/government/news/windrush-day-2024" },
  { title: "World Mental Health Day", dates: [{ year: 2025, month: 10, day: 10 }, { year: 2026, month: 10, day: 10 }], tags: ["awareness-day", "health", "mental-health"], description: "WHO-led global awareness day for mental health.", confidence: "high", sourceUrl: "https://www.who.int/campaigns/world-mental-health-day" },
  { title: "Halloween", dates: [{ year: 2025, month: 10, day: 31 }, { year: 2026, month: 10, day: 31 }], tags: ["cultural-holiday", "entertainment", "retail"], description: "Major retail and entertainment cultural moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Halloween" },
  { title: "Bonfire Night", dates: [{ year: 2025, month: 11, day: 5 }, { year: 2026, month: 11, day: 5 }], tags: ["cultural-holiday", "british", "fireworks"], description: "Guy Fawkes Night. Major UK cultural tradition.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Guy_Fawkes_Night" },
  { title: "Remembrance Day", dates: [{ year: 2025, month: 11, day: 11 }, { year: 2026, month: 11, day: 11 }], tags: ["cultural-holiday", "british", "memorial"], description: "Commemoration of armed forces. Requires careful brand positioning.", confidence: "high", sourceUrl: "https://www.britishlegion.org.uk/get-involved/remembrance" },
  { title: "International Men's Day", dates: [{ year: 2025, month: 11, day: 19 }, { year: 2026, month: 11, day: 19 }], tags: ["awareness-day", "health", "mens-health"], description: "Focus on men's health, positive role models, and gender equality.", confidence: "high", sourceUrl: "https://internationalmensday.com/" },
  { title: "World AIDS Day", dates: [{ year: 2025, month: 12, day: 1 }, { year: 2026, month: 12, day: 1 }], tags: ["awareness-day", "health"], description: "Global awareness day for HIV/AIDS.", confidence: "high", sourceUrl: "https://www.worldaidsday.org/" },

  // --- Variable-date events (computed for 2025 and 2026) ---
  { title: "Chinese New Year", dates: [{ year: 2025, month: 1, day: 29 }, { year: 2026, month: 2, day: 17 }], tags: ["religious-holiday", "cultural", "chinese", "lunar-new-year"], description: "Lunar New Year. Major celebration in UK Chinese communities.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Chinese_New_Year" },
  { title: "Pancake Day (Shrove Tuesday)", dates: [{ year: 2025, month: 3, day: 4 }, { year: 2026, month: 2, day: 17 }], tags: ["cultural-holiday", "food", "british"], description: "Shrove Tuesday. Major food/CPG activation moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Shrove_Tuesday" },
  { title: "Mother's Day UK", dates: [{ year: 2025, month: 3, day: 30 }, { year: 2026, month: 3, day: 22 }], tags: ["cultural-holiday", "gifting", "family"], description: "Mothering Sunday (UK). Major retail and gifting moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Mothering_Sunday" },
  { title: "Ramadan begins", dates: [{ year: 2025, month: 2, day: 28 }, { year: 2026, month: 2, day: 17 }], tags: ["religious-holiday", "islamic", "fasting"], description: "Start of Islamic holy month. Affects media planning around food, evening content.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Ramadan" },
  { title: "Eid al-Fitr", dates: [{ year: 2025, month: 3, day: 30 }, { year: 2026, month: 3, day: 20 }], tags: ["religious-holiday", "islamic", "celebration", "gifting"], description: "End of Ramadan. Major celebration and retail moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Eid_al-Fitr" },
  { title: "Eid al-Adha", dates: [{ year: 2025, month: 6, day: 6 }, { year: 2026, month: 5, day: 27 }], tags: ["religious-holiday", "islamic", "celebration"], description: "Festival of Sacrifice. Major Islamic celebration.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Eid_al-Adha" },
  { title: "Mental Health Awareness Week", dates: [{ year: 2025, month: 5, day: 12 }, { year: 2026, month: 5, day: 11 }], tags: ["awareness-day", "health", "mental-health"], description: "Mental Health Foundation's annual awareness week. Major brand activation moment.", confidence: "high", sourceUrl: "https://www.mentalhealth.org.uk/our-work/public-engagement/mental-health-awareness-week" },
  { title: "Father's Day", dates: [{ year: 2025, month: 6, day: 15 }, { year: 2026, month: 6, day: 21 }], tags: ["cultural-holiday", "gifting", "family"], description: "Major retail and gifting moment.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Father%27s_Day" },
  { title: "Rosh Hashanah", dates: [{ year: 2025, month: 9, day: 22 }, { year: 2026, month: 9, day: 11 }], tags: ["religious-holiday", "jewish", "new-year"], description: "Jewish New Year.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Rosh_Hashanah" },
  { title: "Diwali", dates: [{ year: 2025, month: 10, day: 20 }, { year: 2026, month: 11, day: 8 }], tags: ["religious-holiday", "hindu", "celebration", "gifting", "lights"], description: "Festival of Lights. Major celebration across UK Hindu, Sikh, and Jain communities.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Diwali" },
  { title: "Hanukkah begins", dates: [{ year: 2025, month: 12, day: 14 }, { year: 2026, month: 12, day: 4 }], tags: ["religious-holiday", "jewish", "celebration", "lights"], description: "Jewish Festival of Lights.", confidence: "high", sourceUrl: "https://en.wikipedia.org/wiki/Hanukkah" },
  { title: "World Book Day", dates: [{ year: 2025, month: 3, day: 6 }, { year: 2026, month: 3, day: 5 }], tags: ["awareness-day", "education", "reading"], description: "UK national reading celebration. Major moment for publishers and education brands.", confidence: "high", sourceUrl: "https://www.worldbookday.com/" },
  { title: "Red Nose Day", dates: [{ year: 2025, month: 3, day: 14 }], tags: ["awareness-day", "charity", "entertainment"], description: "Comic Relief's flagship fundraiser (biennial).", confidence: "high", sourceUrl: "https://www.comicrelief.com/rednoseday" },
  { title: "Children in Need", dates: [{ year: 2025, month: 11, day: 14 }, { year: 2026, month: 11, day: 13 }], tags: ["awareness-day", "charity", "entertainment", "bbc"], description: "BBC's annual charity fundraiser.", confidence: "high", sourceUrl: "https://www.bbcchildreninneed.co.uk/" },
];

export async function collectAwarenessDays(params: ConnectorParams): Promise<ConnectorResult> {
  const fromTime = new Date(`${params.from}T00:00:00.000Z`).getTime();
  const toTime = new Date(`${params.to}T23:59:59.999Z`).getTime();

  const moments = AWARENESS_CALENDAR.flatMap((entry) =>
    entry.dates
      .filter((d) => {
        const time = new Date(`${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}T00:00:00.000Z`).getTime();
        return Number.isFinite(time) && time >= fromTime && time <= toTime;
      })
      .map((d) => {
        const dateStr = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
        const sourceId = `awareness|${entry.title}|${dateStr}`;
        const startDateTime = `${dateStr}T00:00:00.000Z`;
        const isReligious = entry.tags.includes("religious-holiday");

        return {
          id: buildMomentId({
            sourceName: "awareness-days",
            sourceId,
            startDateTime,
            title: entry.title
          }),
          sourceId,
          title: entry.title,
          startDateTime,
          timezone: DEFAULT_TIMEZONE,
          region: REGION,
          category: "holidays" as const,
          subcategory: isReligious ? "religious-holiday" : "awareness-day",
          description: entry.description,
          sourceName: "awareness-days",
          sourceUrl: entry.sourceUrl,
          confidence: entry.confidence,
          tags: entry.tags,
          brandSafetyFlags: isReligious ? ["cultural-sensitivity"] : []
        };
      })
  );

  return {
    name: "awareness-days",
    moments,
    cache: "miss" as const,
    warnings: []
  };
}
