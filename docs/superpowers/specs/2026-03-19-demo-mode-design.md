# Demo Mode Design Spec

**Date:** 2026-03-19
**Status:** Draft
**Author:** Claude

## Overview

Add a full demo mode to CultureAgent that works without API keys, activated via the existing "Load demo" button in the UI. This enables POC demos on private servers without requiring valid API credentials.

## Goals

- Demo flow works 100% without any API keys
- Activated via existing "Load demo" button (client-side state)
- Mock data spans 90 days from "today" (dynamic dates)
- Covers all 8 moment connectors, 4 signal providers, and synthesis

## Non-Goals

- Demo mode toggle via URL parameter or environment variable
- Multiple demo scenarios (single happy path only)
- Persistent demo mode across sessions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (useCultureBot hook)                                │
│  isDemoMode: boolean ──────┐                                │
│                             ▼                                │
│  API Calls include demo: true in request body/params        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  API Routes                                                  │
│  if (demo === true) → return mock data                      │
│  else → call real APIs                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  /lib/demo/                                                  │
│  ├── index.ts        → exports + date utilities             │
│  ├── moments.ts      → generateMockMoments(from, to)        │
│  ├── signals.ts      → generateMockSignals()                │
│  ├── synthesis.ts    → generateMockSynthesis(moments)       │
│  └── data/                                                   │
│      ├── films.ts    → film moment templates                │
│      ├── tv.ts       → TV moment templates                  │
│      ├── football.ts → football fixtures                    │
│      ├── f1.ts       → F1 races                             │
│      ├── events.ts   → Ticketmaster events                  │
│      ├── games.ts    → game releases                        │
│      └── signals.ts  → signal templates                     │
└─────────────────────────────────────────────────────────────┘
```

## Data Specifications

### Moments (60-80 total)

All dates generated dynamically relative to "today" over 90 days.

| Connector | Mock Data | Count |
|-----------|-----------|-------|
| TMDB Films | Major film releases (Marvel, action, family) | 8-10 |
| TMDB TV | TV series premieres/finales | 6-8 |
| Ticketmaster | Concerts, festivals, comedy shows in UK | 10-12 |
| RapidAPI Football | Premier League, Champions League fixtures | 12-15 |
| Open F1 | F1 race weekends | 4-5 |
| RAWG Games | Major game releases | 6-8 |
| Gov UK Holidays | Bank holidays | 2-3 |
| Awareness Days | (already static) | 5-8 |

Each moment includes: `id`, `title`, `category`, `startDateTime`, `endDateTime`, `description`, plus connector-specific fields (venue, teams, opponents).

### Signals (4 providers)

| Provider | Mock Data |
|----------|-----------|
| Google Trends | Rising queries: travel, entertainment, "city break", "weekend away" |
| Reddit | Themes: budget travel, student deals, festival planning |
| Wikimedia | Trending entities: films, artists, events |
| Guardian | Articles: travel, culture, entertainment |

### Synthesis

Pre-written synthesis for Airbnb × Gen Z students brief:
- 4-5 themes (Travel & Adventure, Social Experiences, Budget-Friendly Escapes, etc.)
- Each theme with 3-8 momentIds pointing to mock moments
- Activation angles, recommended channels, risks
- Proof-of-use fields populated from mock signals

## Client-Side Changes

### useCultureBot hook

```typescript
// New state
const [isDemoMode, setIsDemoMode] = useState(false);

// Expose in return
return {
  // ... existing
  isDemoMode,
  setIsDemoMode,
};
```

### BriefForm.tsx

```typescript
async function loadDemo() {
  props.setIsDemoMode(true);  // NEW
  // ... existing CSV loading
}
```

### API call modifications

| API Route | Modification |
|-----------|--------------|
| `/api/moments` | Add `?demo=true` query param when isDemoMode |
| `/api/signals` | Add `demo: true` to POST body |
| `/api/playground` | Add `demo: true` to POST body |
| `/api/synthesize` | Add `demo: true` to POST body |

## Server-Side Changes

### /lib/demo/index.ts

```typescript
export function dateRangeFromToday(days: number): { from: string; to: string } {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

export { generateMockMoments } from './moments';
export { generateMockSignals } from './signals';
export { generateMockSynthesis } from './synthesis';
```

### API route pattern

```typescript
// app/api/moments/route.ts
import { generateMockMoments } from '@/lib/demo';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const demo = url.searchParams.get('demo') === 'true';

  if (demo) {
    const from = url.searchParams.get('from')!;
    const to = url.searchParams.get('to')!;
    const moments = generateMockMoments(from, to);
    return Response.json({ moments, meta: { demo: true } });
  }

  // existing live logic
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `lib/demo/index.ts` | Exports + date utilities |
| `lib/demo/moments.ts` | generateMockMoments() |
| `lib/demo/signals.ts` | generateMockSignals() |
| `lib/demo/synthesis.ts` | generateMockSynthesis() |
| `lib/demo/data/films.ts` | Film moment templates |
| `lib/demo/data/tv.ts` | TV moment templates |
| `lib/demo/data/football.ts` | Football fixture templates |
| `lib/demo/data/f1.ts` | F1 race templates |
| `lib/demo/data/events.ts` | Event templates |
| `lib/demo/data/games.ts` | Game release templates |
| `lib/demo/data/signals.ts` | Signal templates |

## Files to Modify

| File | Change |
|------|--------|
| `app/hooks/useCultureBot.ts` | Add isDemoMode state |
| `app/components/BriefForm.tsx` | Set isDemoMode on loadDemo |
| `app/api/moments/route.ts` | Check demo param |
| `app/api/signals/route.ts` | Check demo in body |
| `app/api/playground/route.ts` | Check demo in body |
| `app/api/synthesize/route.ts` | Check demo in body |

## Implementation Order

1. Create `/lib/demo/index.ts` with date utilities
2. Create mock moment data files (`/lib/demo/data/*.ts`)
3. Create `/lib/demo/moments.ts` to aggregate and generate
4. Create `/lib/demo/signals.ts`
5. Create `/lib/demo/synthesis.ts`
6. Add `isDemoMode` to `useCultureBot.ts`
7. Modify `BriefForm.tsx` to set demo mode
8. Modify API routes to check demo flag
9. Pass demo flag from client hooks to API calls
10. Test full demo flow

## Success Criteria

- [ ] Clicking "Load demo" sets isDemoMode = true
- [ ] All API calls include demo flag when in demo mode
- [ ] Moments API returns 60-80 mock moments spanning 90 days
- [ ] Signals API returns mock Google Trends, Reddit, Wikimedia, Guardian data
- [ ] Synthesis API returns pre-written synthesis without calling OpenAI
- [ ] Full brief → playground → audience → builder flow works without any API keys
