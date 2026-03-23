import type { GoogleTrendsSignals } from "@/lib/signals/types";
import type { GuardianSignals } from "@/lib/signals/providers/guardian";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}

export function demoGoogleTrendsSignals(): GoogleTrendsSignals {
  return {
    topRelatedQueries: [
      { query: "airbnb student discount", type: "top", value: 100 },
      { query: "cheap city breaks europe", type: "top", value: 85 },
      { query: "weekend getaway ideas", type: "top", value: 72 },
      { query: "self catering accommodation", type: "rising", value: 400 },
      { query: "gen z travel trends", type: "rising", value: 320 }
    ],
    topRelatedTopics: [
      { topic: "City break", type: "top", value: 100 },
      { topic: "Backpacking", type: "top", value: 68 },
      { topic: "Short-term rental", type: "rising", value: 250 },
      { topic: "Budget travel", type: "rising", value: 190 }
    ],
    interestOverTime: [
      { date: "2026-01-26", value: 42 },
      { date: "2026-02-02", value: 55 },
      { date: "2026-02-09", value: 61 },
      { date: "2026-02-16", value: 78 },
      { date: "2026-02-23", value: 85 },
      { date: "2026-03-02", value: 72 },
      { date: "2026-03-09", value: 90 },
      { date: "2026-03-16", value: 95 }
    ],
    sources: [{ name: "GoogleTrends", url: "https://trends.google.com/" }]
  };
}

export function demoGuardianSignals(): GuardianSignals {
  return {
    articles: [
      {
        title: "Gen Z travellers turn to short-stay rentals as hotel prices surge",
        section: "Travel",
        url: "https://www.theguardian.com/travel/2026/mar/10/gen-z-short-stay-rentals",
        publishedAt: "2026-03-10T08:00:00Z",
        trailText: "Young travellers are choosing Airbnb-style stays for city breaks, driven by cost and social media inspiration."
      },
      {
        title: "The rise of the micro-break: why weekends away are booming",
        section: "Travel",
        url: "https://www.theguardian.com/travel/2026/mar/05/micro-break-weekends-booming",
        publishedAt: "2026-03-05T10:30:00Z",
        trailText: "Two-night city breaks are the fastest-growing segment in UK domestic tourism."
      },
      {
        title: "Self-catering holidays see record bookings for spring 2026",
        section: "Business",
        url: "https://www.theguardian.com/business/2026/feb/28/self-catering-record-spring",
        publishedAt: "2026-02-28T14:00:00Z",
        trailText: "Budget-conscious consumers drive a 23% increase in self-catering accommodation searches."
      },
      {
        title: "How social media is reshaping where Gen Z goes on holiday",
        section: "Technology",
        url: "https://www.theguardian.com/technology/2026/feb/20/social-media-gen-z-holiday",
        publishedAt: "2026-02-20T09:15:00Z",
        trailText: "TikTok and Instagram are now the primary discovery channels for under-25 travellers."
      },
      {
        title: "Student travel: the destinations and deals trending for Easter 2026",
        section: "Education",
        url: "https://www.theguardian.com/education/2026/feb/15/student-travel-easter-2026",
        publishedAt: "2026-02-15T07:45:00Z",
        trailText: "European city breaks dominate student wishlists, with Lisbon, Budapest, and Barcelona leading."
      }
    ],
    topSections: ["Travel", "Business", "Technology", "Education"],
    sources: [{ name: "The Guardian", url: "https://www.theguardian.com" }]
  };
}
