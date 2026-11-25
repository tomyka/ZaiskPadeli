# Copilot Instructions — Žaisk Padelį (zaiskpadeli.lt)

Padel court availability aggregator for Lithuania. Nuxt 4 (Nitro server) deployed on Vercel, region `arn1` (Stockholm).

## Commands

```bash
npm run dev        # dev server at http://localhost:3000
npm run build      # production build
npm run preview    # preview production build locally
npx vercel --prod --yes  # deploy to production
```

Quality gates: `npm run typecheck` (nuxi/vue-tsc), `npm test` (Vitest, `tests/**/*.test.ts`, HTML fixtures in `tests/fixtures/`), `npm run check` runs both. CI (`.github/workflows/ci.yml`) runs typecheck, tests, build, and the cf-proxy Worker typecheck + bundle dry-run on every push/PR. Keep parsing logic in pure exported functions so it can be fixture-tested.

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
    venues.ts                # VENUE REGISTRY — single source of venue metadata (pure data, also imported by the client)
    scraper-all.ts           # binds each venue id to a scraper (SCRAPERS) + runner (Venue shell, deadline, error handling)
    ntennis.ts               # pure parser shared by all nTennis/nSoft grid venues (a1padel, kaunopadelis, tennisspace, vilniuspadel)
    ntennis-fetch.ts         # nTennis guest-login + grid fetch — RUNTIME-AGNOSTIC: also bundled into cf-proxy (web APIs only, no cheerio/Nitro auto-imports)
    parse.ts                 # small pure HTML helpers: parseEuro, parseBgColor, expandHourHeader
    scraper-*.ts             # one file per venue / platform; each returns Court[]
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

1. Add an entry to `VENUES` in `server/utils/venues.ts` (id, name, address, city, bookingUrl, indoor default, accent colour). This alone drives the venue card, filter pill colour and the city's "coming soon" badge.
2. Bind a scraper in `SCRAPERS` in `server/utils/scraper-all.ts`. `SCRAPERS` is a `Record<VenueId, Scraper>`, so **typecheck fails until every registry venue has a scraper**.
   - **Winero arena**: `myvenue: wineroScraper({ arenaId: '<uuid from /api/arenas?sport=padel>', skipCourts: ['kamuoliukų mašina', 'ball machine'] })`
   - **nTennis/nSoft site**: a ~10-line file calling `fetchNTennisGrid({ baseUrl, placeId }, date)` then `parseNTennisGrid(html, { idPrefix: venue.id, ... })`
   - **Custom**: create `server/utils/scraper-<name>.ts` exporting `scrape<Name>(date: string, venue: VenueInfo): Promise<Court[]>`. Build court ids as `${venue.id}-<platform court id>` (never hard-code the venue id). Keep parsing in a pure exported function and add a fixture test in `tests/`.

### Venue and Court IDs

- `venue.id`: short lowercase identifier, e.g. `padelhub`, `kaunopadelis`, `harmonypark`
- `court.id`: `${venueId}-${platformCourtId}` — must be stable across scrapes

### Court interface

```ts
interface Court {
  id: string
  name: string
  type: 'doubles' | 'singles' | 'unknown'
  indoor?: boolean    // omit to use the registry default; set per court only when it varies (e.g. K-Padel)
  slots: TimeSlot[]   // 30-min slots; { time: "HH:MM", available: boolean, price: number|null }
}
```

### Scraper error handling

Scrapers **throw** on any failure (HTTP error, login failure, unexpected markup) with a descriptive message. The runner in `scraper-all.ts` catches it, logs `[venueId] scrape failed` with the detail, and sets a uniform Lithuanian `venue.error` — so one broken venue never fails the response. It also enforces a per-venue deadline and flags venues that return no courts. Don't build `Venue` objects or catch-and-swallow inside scrapers.

### Past slots (today only)

When scraping today, mark finished slots unavailable: `const now = currentMinutesFor(date)` then `available = ... && !isSlotOver(time, now)`.

### Winero scraper internals

Winero's public API (`winero.lt/api/`) returns **booked** slots, not available ones. The scraper:
1. Fetches `/api/arenas/{id}` for court list, price periods, and opening hours
2. Fetches `/api/bookings/public-availability?arena_id={id}&date={date}` for bookings
3. Generates all 30-min slots from opening hours, marks booked ones as unavailable
4. Prices are per-hour in the API → divide by 2 for per-30-min display

### K-Padel / Moove.lt platform

Uses `app.moove.lt/api/v1/settings/tickets/user?locationIds=227&sport=padel&...`. Returns all time-slot "tickets"; status `"free"` = available. Price is in euro cents (÷100 for euros). Indoor/outdoor is detected by `"laukas"` in court name (Lithuanian for "outdoor field").

### Padel4U (padel4u.cloud, custom WordPress plugin)

The booking page embeds `var padelReservations = {nonce, courts:[{id,name}]}`. Availability: `POST /wp-admin/admin-ajax.php` with `action=padel_get_available_slots&nonce&court_id&date` → one entry per 30-min slot with its own price and `available`. The club is open until 02:30 and lists after-midnight slots under the same date; the scraper drops them (our grid is one calendar day). Dates past the ~30-day booking window return `success:false` ("Rezervuoti galima tik iki …") and return no courts, so the venue shows "Nėra duomenų šiai dienai" rather than a fetch failure.

### UI filter state (index.vue)

Refs: `selectedCity`, `selectedDate`, `filterStart`, `filterEnd`, `filterType`, `filterIndoor`, `activeVenue`. The computed `filteredCourts(venue)` applies all active filters. Courts with `indoor === undefined` are shown regardless of the indoor/outdoor filter.

### Deployment

```bash
npx vercel --prod --yes
```

The cron job (`CRON_SECRET` env var) is called via GitHub Actions (`.github/workflows/scrape-cron.yml`) every 30 minutes; it annotates the run with venues that failed to scrape — no Vercel Cron configuration needed.
