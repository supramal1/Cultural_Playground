# Culture Bot

UK-focused planner/strategist web app built with Next.js + TypeScript.

## Scope

- Region is fixed to `UK`.
- Source-backed moments come from APIs/feeds.
- Signals layer includes Google Trends, Reddit, and Wikimedia pageviews.
- Moments/connectors are the only source of factual event data.
- Signals and insights are evidence + ranking/context inputs (not moment creators).
- Perplexity is context-only and never alters moments.
- Synthesis/brief outputs are constrained and pointer-validated.

## Features

- V3 planner flow on one page: `Brief -> Playground -> Brief Builder -> Proof`.
- Default scannable outputs:
  - 3 playground cards
  - 8 opportunity cards
- Optional moments picker inserts supporting moments into the brief.
- Exports:
  - Email-ready brief text
  - Markdown brief
  - Slide JSON
  - Opportunities CSV
- Insight Inputs uploads:
  - Audience Make-up CSV
  - Search Insights CSV
- Brand-first signals step (`/api/brand-signals`) using deterministic Reddit brand queries (+ optional Perplexity discourse context).
- Playground context endpoint (`/api/playground-context`) for anchor validation.
- Opportunity context endpoint (`/api/opportunity-context`) for top moment context.
- Deterministic scoring with category-specific major boosts.
- Ranked moments include `baseScore`, `finalScore`, and `signalBoost`.
- `/api/synthesize` supports modes:
  - plan synthesis (existing v2)
  - blueprint synthesis (`mode="blueprint"`)
  - media owner brief synthesis (`mode="brief"`)
- Slide endpoint supports both legacy plan synthesis input and MediaOwnerBrief input.
- Post-generation id validation + one corrective retry if invalid ids are returned.
- Connector-level caching in `./.cache` with TTL (default 6 hours).
- Cache key includes connector name + params + version + key-presence flag.

## Environment variables

Create `.env.local`:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=
TMDB_API_KEY=
FOOTBALL_DATA_API_KEY=
RAPIDAPI_KEY=
RAPIDAPI_FOOTBALL_HOST=free-api-live-football-data.p.rapidapi.com
RAPIDAPI_MAX_REQUESTS_PER_SEARCH=10
TICKETMASTER_API_KEY=
PERPLEXITY_API_KEY=
PERPLEXITY_MODEL=sonar
PERPLEXITY_BASE_URL=https://api.perplexity.ai
ENABLE_GOOGLE_TRENDS_SIGNALS=1
ENABLE_REDDIT_SIGNALS=1
ENABLE_WIKIMEDIA_SIGNALS=1
WIKIMEDIA_PROJECT=en.wikipedia
WIKIMEDIA_CLIENT_ID=
WIKIMEDIA_CLIENT_SECRET=
WIKIMEDIA_ACCESS_TOKEN=
PYTHON_BIN=python3
```

Notes:
- `OPENAI_API_KEY` is required for `/api/synthesize` and `/api/slide`.
- `TMDB_API_KEY`, `FOOTBALL_DATA_API_KEY`, `RAPIDAPI_KEY`, `TICKETMASTER_API_KEY` are optional connectors.
- `PERPLEXITY_API_KEY` is optional and powers analyst-facing external context in `/api/context`.
- Sports provider priority is `FOOTBALL_DATA_API_KEY` first, then `RAPIDAPI_KEY` fallback.
- `RAPIDAPI_MAX_REQUESTS_PER_SEARCH` defaults to `10` to help fit low daily quotas.
- Ticketmaster Discovery uses `TICKETMASTER_API_KEY`.
- Missing connector keys are handled gracefully and surfaced in UI metadata.
- Wikimedia client credentials are optional; pageviews generally work unauthenticated.
- Google Trends and Reddit signals use Python subprocess runners.

## Data sources (V1)

- UK bank holidays: GOV.UK `https://www.gov.uk/bank-holidays.json`
- Film releases: TMDB Discover API
- Football fixtures: football-data.org competitions (configured list in `lib/config.ts`)
- Sports fallback: RapidAPI free-api-live-football-data (`/football-get-matches-by-date`)
- Events: Ticketmaster Discovery API (`/discovery/v2/events.json`, country `GB`)
- Signals:
  - Google Trends (scraper runner)
  - Reddit public search/top posts (scraper runner)
  - Wikimedia Analytics Pageviews API

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional (for Google Trends runner):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r lib/python/requirements.txt
```

## API

### `GET /api/moments`

Query params:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `categories=sports,film,holidays,events`
- `boost=Arsenal,Liverpool,Marvel`
- `insightsKeywords=term1,term2` (optional, usually sent by UI from uploaded insights)
- `audience=Gen Z football fans` (optional)
- `brandConstraints=Avoid alcohol adjacency` (optional)
- `refresh=1` (optional, bypasses connector cache for a live pull)

Example:

```bash
curl "http://localhost:3000/api/moments?from=2026-02-12&to=2026-03-15&categories=sports,film,holidays&boost=Arsenal,Liverpool"
```

Enforced safeguards:
- max date range default: 90 days
- dedupe by `sourceName + sourceId`
- strict zod validation of moments

Response shape:

```json
{
  "moments": [{ "id": "...", "title": "...", "score": 123 }],
  "meta": {
    "enabledConnectors": ["gov-uk-holidays"],
    "skippedConnectors": [{ "name": "tmdb-films", "reason": "TMDB_API_KEY missing" }],
    "cache": { "hits": [], "misses": ["gov-uk-holidays"] },
    "warnings": []
  }
}
```

### `POST /api/synthesize`

Body:

```json
{
  "moments": [{ "id": "...", "score": 123 }],
  "audience": "optional",
  "brandConstraints": "optional",
  "insights": { "audience": {}, "search": {} },
  "signals": { "meta": {}, "warnings": [] },
  "includeAll": false
}
```

Modes:
- existing plan mode (v1/v2 compatibility)
- `mode=\"blueprint\"` -> returns `PlaygroundBlueprint`
- `mode=\"brief\"` -> returns `MediaOwnerBrief`

Guardrails:
- OpenAI Responses API Structured Outputs (strict schema)
- moment id checks where applicable
- evidence pointer subset validation against allowed pointer universe
- one corrective retry on invalid ids/pointers

### `POST /api/slide`

Body:

```json
{
  "moments": [{ "id": "...", "score": 123 }],
  "synthesis": { "execSummary": "...", "themes": [], "topMomentIds": [], "notes": [] },
  "audience": "optional",
  "brandConstraints": "optional",
  "includeAll": false
}
```

Supports:
- legacy plan+synthesis payload (v2 existing)
- MediaOwnerBrief payload (v3 brief-builder export path)

### `POST /api/context`

Body:

```json
{
  "moments": [{ "id": "...", "score": 123 }],
  "synthesis": { "execSummary": "...", "themes": [] },
  "insights": { "audience": {}, "search": {} },
  "signals": { "meta": {}, "warnings": [] },
  "brand": "optional",
  "audience": "optional",
  "brandConstraints": "optional",
  "includeAll": false
}
```

Behavior:
- uses top moments by score (`N=40`) unless `includeAll=true`
- enforces max range (`90` days) like synthesis/slide
- calls Perplexity Chat Completions with JSON schema output
- can ingest existing synthesis output to refine context relevance
- returns strategy context + source links
- does not alter source-backed moments, scoring, or factual rendering

### `POST /api/insights/audience`

Multipart upload (`file`) for Audience Make-up CSV.

### `POST /api/insights/search`

Multipart upload (`file`) for Search Insights CSV.

### `POST /api/signals`

Body:

```json
{
  "keywords": ["arsenal", "marvel"],
  "audience": "Gen Z sports fans",
  "from": "2026-02-01",
  "to": "2026-03-01",
  "maxKeywords": 20
}
```

Returns unified trends/conversation/pageview signals plus warnings. Provider failures return partial signals and do not hard-fail the full planning pipeline.

### `POST /api/brand-signals`

Runs deterministic brand discourse seeding:
- Reddit brand queries (max 3 queries, bounded post usage)
- optional Perplexity brand discourse call (best-effort)
- returns:
  - `brandThemes`
  - `brandAdjacencyKeywords`
  - `brandSubreddits`
  - `brandRiskFlags`
  - diagnostics + query strategy metadata

If brand is missing, returns `ok: true` with deterministic empty signals and skipped notes.

### `POST /api/playground-context`

Perplexity-backed, non-blocking validation/anchor context for candidate playgrounds.

### `POST /api/opportunity-context`

Perplexity-backed, non-blocking context for top opportunities (max 5 input moments).

## Testing

```bash
npm test
```

Covers:
- scoring behavior
- cache key + read/write
- zod schema validation
- synthesis id verification
- slide id verification
- dedupe behavior
- API guardrails (date range + score in output contract)
- Ticketmaster connector normalization
- insights CSV parsing + keyword combining
- signals provider/service validation and resilience
- brand-signals route deterministic empty behavior (brand missing)
- playground ordering sensitivity to brand adjacency keywords
- query cap metadata checks (discovery and plan)
- playground context best-effort + cache behavior
- blueprint/brief synthesis pointer-universe validation

## Limitations

- Scraper providers (Google Trends/Reddit) may be brittle to upstream changes.
- Signals are context only and do not create factual moments.
