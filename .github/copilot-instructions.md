# Copilot Instructions — Žaisk Padelį (zaiskpadeli.lt)

Padel court availability aggregator for Lithuania. Nuxt 4 (Nitro server) deployed on Vercel, region `arn1` (Stockholm).

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
npm run preview    # preview production build locally
npx vercel --prod --yes  # deploy to production
```

Quality gates: `npm run typecheck` (nuxi/vue-tsc), `npm test` (Vitest, `tests/**/*.test.ts`, HTML fixtures in `tests/fixtures/`), `npm run check` runs both. CI (`.github/workflows/ci.yml`) runs typecheck, tests and build on every push/PR. Keep parsing logic in pure exported functions so it can be fixture-tested.

## Architecture

```
app/pages/index.vue          # single-page frontend (Vue 3 Composition API)
server/
  api/
    availability.get.ts      # GET /api/availability?date=YYYY-MM-DD — main data endpoint
    stats.get.ts             # GET /api/stats
    cron/scrape.get.ts       # GET /api/cron/scrape — pre-warms cache (called by GitHub Actions every 30 min)
  middleware/
    analytics.ts             # request logging
    rate-limit.ts            # 20 req/IP/min for /api/*
  utils/
    types.ts                 # shared TypeScript interfaces (Court, Venue, TimeSlot, City, etc.)
    cache.ts                 # Vercel KV cache (in-memory fallback for local dev)
    time.ts                  # Lithuanian timezone utilities — always use these
    ntennis.ts               # pure parser shared by all nTennis/nSoft grid venues (a1padel, kaunopadelis, tennisspace, vilniuspadel)
    parse.ts                 # small pure HTML helpers: parseEuro, parseBgColor, expandHourHeader
    scraper-all.ts           # imports and runs all scrapers in parallel
    scraper-*.ts             # one file per venue / platform
```

### Request flow

`index.vue` fetches `/api/availability?date=YYYY-MM-DD` → Nitro handler checks Vercel KV cache (fresh = <5 min, stale = <60 min) → on miss/stale, `scrapeAllVenues()` runs all scrapers in parallel → result stored in KV → returned to client. A GitHub Actions cron hits `/api/cron/scrape` every 30 minutes to pre-warm the cache for today and the next 2 days.

### Cache

- **Fresh** (< 5 min): served directly from KV, no re-scrape
- **Stale** (5–60 min): triggers background re-scrape; if scrape fails, stale data is returned as fallback
- **Local dev**: no KV credentials → in-memory `Map` fallback (auto-detected by `isKVAvailable()`)
- Env vars required in prod: `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `CRON_SECRET`

## Key Conventions

### Timezone — critical

Vercel runs in UTC. **Never use `new Date()` directly for date/time logic.** Always use utilities from `server/utils/time.ts`:

```ts
todayLT()           // → "2026-05-28" (Lithuanian date)
nowLTMinutes()      // → minutes since midnight in LT timezone
isDateTodayLT(date) // → boolean
nextDatesLT(n)      // → ["2026-05-28", "2026-05-29", ...]
```

### Adding a new venue

**Option A — Winero platform** (preferred for winero.lt arenas): add a config entry to `WINERO_VENUES` in `scraper-winero.ts`. Required fields:

```ts
{
  id: '<winero-arena-uuid>',    // from /api/arenas?sport=padel
  venueId: 'shortid',          // snake_case, used as venue.id and in VENUE_COLORS
  name: 'Display Name',
  address: 'Street, City',
  city: 'Vilnius',             // one of the City union type
  bookingUrl: 'https://...',
  indoor: true,                // or false; omit if unknown
  skipCourts: ['ball machine'], // optional: substrings to skip (case-insensitive)
}
```

No changes to `scraper-all.ts` needed — Winero venues are spread in automatically.

**Option B — custom scraper**: create `server/utils/scraper-<name>.ts`, export an async function `scrape<Name>(date: string): Promise<Venue>`, then import and add it to `scraper-all.ts`.

### Venue and Court IDs

- `venue.id`: short lowercase identifier, e.g. `padelhub`, `kaunopadelis`, `harmonypark`
- `court.id`: `${venueId}-${platformCourtId}` — must be stable across scrapes
- Add a matching entry to `VENUE_COLORS` in `app/pages/index.vue` for accent color/pill styling

### Court interface

```ts
interface Court {
  id: string
  name: string
  type: 'doubles' | 'singles' | 'unknown'
  indoor?: boolean    // true=indoor, false=outdoor, undefined=unknown (shown in both filter views)
  slots: TimeSlot[]   // 30-min slots; { time: "HH:MM", available: boolean, price: number|null }
}
```

### Scraper error handling pattern

Each scraper must **never throw** — set `venue.error` instead and return the partial venue. This ensures one broken venue doesn't fail the entire response:

```ts
try {
  // ... fetch and parse ...
} catch (err) {
  venue.error = 'Failed to fetch XYZ data'
}
return venue
```

### Past slots (today only)

When scraping today, mark past 30-min slots as `available: false`. Use `isDateTodayLT(date)` + `nowLTMinutes()` and skip slots where `slotEnd <= currentMinutes`.

### Winero scraper internals

Winero's public API (`winero.lt/api/`) returns **booked** slots, not available ones. The scraper:
1. Fetches `/api/arenas/{id}` for court list, price periods, and opening hours
2. Fetches `/api/bookings/public-availability?arena_id={id}&date={date}` for bookings
3. Generates all 30-min slots from opening hours, marks booked ones as unavailable
4. Prices are per-hour in the API → divide by 2 for per-30-min display

### K-Padel / Moove.lt platform

Uses `app.moove.lt/api/v1/settings/tickets/user?locationIds=227&sport=padel&...`. Returns all time-slot "tickets"; status `"free"` = available. Price is in euro cents (÷100 for euros). Indoor/outdoor is detected by `"laukas"` in court name (Lithuanian for "outdoor field").

### UI filter state (index.vue)

Refs: `selectedCity`, `selectedDate`, `filterStart`, `filterEnd`, `filterType`, `filterIndoor`, `activeVenue`. The computed `filteredCourts(venue)` applies all active filters. Courts with `indoor === undefined` are shown regardless of the indoor/outdoor filter.

### Deployment

```bash
npx vercel --prod --yes
```

The cron job (`CRON_SECRET` env var) is called via GitHub Actions (`.github/workflows/scrape-cron.yml`) every 30 minutes; it annotates the run with venues that failed to scrape — no Vercel Cron configuration needed.
