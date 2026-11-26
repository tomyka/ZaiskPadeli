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
    cron/scrape.get.ts       # GET /api/cron/scrape — pre-warms cache (called every 5 min by the cf-proxy Worker's cron trigger)
  middleware/
    analytics.ts             # request logging
    rate-limit.ts            # 20 req/IP/min for /api/*
  utils/
    types.ts                 # shared TypeScript interfaces (Court, Venue, TimeSlot, ScrapeReport, etc.)
    regions.ts               # counties + municipalities (pure data); venues record a municipality, the county is derived; the visitor's selection (and its invariant) lives in app/utils/location.ts
    availability-store.ts    # get(date) / refresh(date): freshness, per-venue carry-over, dedupe; storage seam (KV adapter, in-memory adapter)
    time.ts                  # Lithuanian timezone utilities — always use these
    venues.ts                # VENUE REGISTRY — single source of venue metadata (pure data, also imported by the client)
    scraper-all.ts           # SCRAPERS: each venue id → its ScraperSpec (platform + ids, or `own`); scraperFor; runner (Venue shell, deadline, error handling)
    day-grid.ts              # the venue day as half-hour slots: toSlots (past slots, price only if free), openingSlots (past midnight), bookedAt, perHalfHour
    ntennis.ts               # pure parser shared by every nTennis/nSoft grid venue
    ntennis-fetch.ts         # nTennis guest-login + grid fetch — RUNTIME-AGNOSTIC: also bundled into cf-proxy (web APIs only, no cheerio/Nitro auto-imports)
    gopadel-fetch.ts         # GO Padel API day fetch — RUNTIME-AGNOSTIC, same rules as ntennis-fetch.ts
    protected-sites.ts       # Cloudflare-protected sites (kaunopadelis, gopadel): fetch + check per site — RUNTIME-AGNOSTIC, shared with the Worker
    protected-fetch.ts       # fetchProtectedDay(site, date): through the cf-proxy Worker in prod, directly in dev; runs the site's check
    user-agent.ts            # BROWSER_UA for sites that turn away obvious bots
    parse.ts                 # small pure HTML helpers: parseEuro, parseBgColor, expandHourHeader, courtTypeFromName
    scraper-*.ts             # platform scrapers (moove, ntennis, winero, playball: factories taking that platform's ids) and clubs' own systems; each returns Court[]
app/components/              # shared UI: SelectMenu, SegmentedControl, BottomSheet, VenueCard, SessionDetails, CourtFilters, CourtTags
app/utils/
  location.ts                # the visitor's Location (county + optional municipality), its moves and filter choices
  availability.ts            # buildAvailabilityView: what the page shows for the filters (pure)
  venue-status.ts            # venue status → Lithuanian wording
  prefs.ts                   # cookie prefs parsing (incl. migration of old { city } cookies)
```

### Request flow

`index.vue` fetches `/api/availability?date=YYYY-MM-DD` → the availability store (`server/utils/availability-store.ts`, `useAvailabilityStore().get(date)`) serves stored data under 5 min old, otherwise `refresh(date)` runs `scrapeAllVenues()` (one shared scrape per date per instance) and stores the result. The cf-proxy Worker's cron trigger hits `/api/cron/scrape` every 5 minutes to pre-warm the cache for today and the next 2 days. Every refresh goes through the store: a venue whose scrape fails keeps its last good courts while they are under 60 min old (judged by the venue's own `lastUpdated`).

### Cache

- **Fresh** (< 5 min): served directly from KV, no re-scrape
- **Stale** (5–60 min): the request re-scrapes (blocking); venues that fail keep their courts from the stale entry
- **Local dev**: no KV credentials → in-memory storage adapter (`useAvailabilityStore()` picks the adapter; tests build their own store with `createAvailabilityStore`)
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

1. Add an entry to `VENUES` in `server/utils/venues.ts` (id, name, address, municipality, bookingUrl, indoor default, accent colour). This alone drives the venue card, filter pill colour and the county's "coming soon" badge. If the venue's municipality is new, add it to `MUNICIPALITY_COUNTY` in `server/utils/regions.ts`.
2. Add its `ScraperSpec` to `SCRAPERS` in `server/utils/scraper-all.ts`. `SCRAPERS` is a `Record<VenueId, ScraperSpec>`, so **typecheck fails until every registry venue has one**. Specs stay out of `venues.ts` because that file is bundled into the client and some specs carry guest credentials. On a known platform it is one line of data:
   - **Moove**: `{ platform: 'moove', locationId, indoor? }`; bookingUrl `https://app.moove.lt/padel/club/reservation/<clubId>?locationId=<locationId>`
   - **nTennis/nSoft**: `{ platform: 'ntennis', baseUrl, placeId, fallbackGuest?, nameFromSpan? }`; bookingUrl on the same origin. Behind Cloudflare: add the site to `protected-sites.ts` and use `{ platform: 'ntennis', protected: '<site>' }`
   - **Winero**: `{ platform: 'winero', arenaId: '<uuid from /api/arenas?sport=padel>', skipCourts? }`
   - **Playball**: `{ platform: 'playball', slug }`; bookingUrl `…/arenas/<slug>/book`
   - **A club's own system**: create `server/utils/scraper-<name>.ts` exporting `scrape<Name>(date, venue)` and bind `{ platform: 'own', scrape: scrape<Name> }`. Build court ids as `${venue.id}-<platform court id>` (never hard-code the venue id). Turn upstream data into slots with `toSlots` / `openingSlots` / `bookedAt` from `day-grid.ts`, keep parsing in a pure exported function, and add a fixture test (pure, plus one through the scraper with `routeFetch` from `tests/server/helpers/fake-fetch.ts`).

   `tests/server/scrapers-e2e.test.ts` checks each bookingUrl names the place its spec scrapes.

### Venue and Court IDs

- `venue.id`: short lowercase identifier, e.g. `padelhub`, `kaunopadelis`, `harmonypark`
- `court.id`: `${venueId}-${platformCourtId}` — must be stable across scrapes

### Court interface

```ts
interface Court {
  id: string
  name: string
  type: 'doubles' | 'singles' | 'unknown'
  indoor?: boolean    // omit to use the registry default; set per court only when it varies (Moove "laukas" courts, Playball court_type)
  slots: TimeSlot[]   // 30-min slots; { time: "HH:MM", available: boolean, price: number|null }
}
```

### Scraper error handling

Scrapers **throw** on any failure (HTTP error, login failure, unexpected markup) with a descriptive message. The runner in `scraper-all.ts` catches it, logs `[venueId] scrape failed` with the detail, and sets `venue.status = 'failed'` — so one broken venue never fails the response. It also enforces a per-venue deadline and marks venues that return no courts `'empty'`. The store turns a failed venue with recent good data into `'stale'`; the client maps status to Lithuanian wording in `app/utils/venue-status.ts`. Don't build `Venue` objects or catch-and-swallow inside scrapers.

### Past slots (today only)

Build slots with `toSlots(cells, currentMinutesFor(date))` from `day-grid.ts`: it marks finished slots unavailable (today only) and keeps prices on available slots only. A venue day can run past midnight: "00:30" after a late evening sorts and counts as the end of that day (`dayMinutes` in `time.ts`).

### Winero scraper internals

Winero's public API (`winero.lt/api/`) returns **booked** slots, not available ones. The scraper:
1. Fetches `/api/arenas/{id}` for court list, price periods, and opening hours
2. Fetches `/api/bookings/public-availability?arena_id={id}&date={date}` for bookings
3. Generates all 30-min slots from opening hours, marks booked ones as unavailable
4. Prices are per-hour in the API → divide by 2 for per-30-min display

### Moove.lt platform (K-Padel, Drevernos, Fanų, Sky Padel, UPadel …)

`mooveScraper` in `scraper-moove.ts`: `app.moove.lt/api/v1/settings/tickets/user?locationIds=<id>&sport=padel&size=1000…` returns every half-hour "ticket" of the day; status `"free"` = available; price in euro cents per half hour. A day that doesn't fit one page fails rather than show partial data. Location ids: `/api/v1/settings/locations?size=500`. A court named "… laukas" ("outdoor field") is outdoor even at an indoor location. Check a location has real bookings before adding it (#41).

### Padel4U (padel4u.cloud, custom WordPress plugin)

The booking page embeds `var padelReservations = {nonce, courts:[{id,name}]}`. Availability: `POST /wp-admin/admin-ajax.php` with `action=padel_get_available_slots&nonce&court_id&date` → one entry per 30-min slot with its own price and `available`. The club is open until 02:30 and lists after-midnight slots under the same date; they are kept, at the end of that venue day. Dates past the ~30-day booking window return `success:false` ("Rezervuoti galima tik iki …") and return no courts, so the venue shows "Nėra duomenų šiai dienai" rather than a fetch failure.

### UI components and style

Every control must look like the rest of the app. Use the palette tokens in `tailwind.config.ts` (`ink`, `ball`, `court`) rather than raw colours (the one accepted exception is `text-gray-600` for secondary text, which has no token), and reuse the existing components before writing new markup:

- `SelectMenu` — single-choice dropdown (pill trigger, rounded panel, keyboard + screen-reader support). Use it instead of a native `<select>`, whose open list the OS draws in its own style. Both pickers use it: county (`active` when narrowed) and start time (`dashed` = optional refinement, `compact` = no chevron on phones so it fits beside the duration pills).
- `SegmentedControl` — a few mutually exclusive options in a row.
- `BottomSheet` — phone sheets / dialogs.
- Chips and pills: `h-11 rounded-full border px-3.5 text-sm`; selected/active filter = `border-ink bg-ink text-ball`, otherwise `border-court-line bg-white text-ink hover:border-ink/40`. Tap targets are at least 44px.

Check new UI in a real browser at phone and desktop widths, including open, hover and focus states (`.claude/tools/browse.mjs`).

### UI filter state (index.vue)

Refs: `location` (a `Location` from `app/utils/location.ts`: county + optional municipality, changed only through its moves `chooseCounty`, `chooseMunicipality`, `locateAt`), `selectedDate`, `fromTime`, `duration`, `filterType`, `filterIndoor`, `selectedKey` (the open session). The computed `view` = `buildAvailabilityView(venues, filters, now)` applies all of them; the page only binds it. Courts with `indoor === undefined` are shown regardless of the indoor/outdoor filter.

### Logo

"Paukščiukas" (#51): the Ž of Žaisk, its háček a bounce with the ball at the bounce point (white Z, ball-orange háček and ball, an ink ring around the ball). The Z is always the wordmark font's own Z (Barlow Condensed Bold), so the Ž is as wide and heavy as the other letters. In the header it is real text, with only the háček drawn: an SVG sized in `em` (as wide as the Z, about 0.03em above the cap height), so it scales with the font. Hovering the logo bounces the ball. The icons (`public/favicon.svg`, `icon-192.png`, `icon-512.png` full-bleed inside the maskable safe zone, and a 32 px `favicon.ico`) come from `scripts/logo-icons.mjs`. It traces the font's Z as a polygon (an SVG favicon can't load web fonts) and its header comment says how to render the PNGs. Below ~48 px it uses the bold háček (thicker arms, no ball seam). The loading state uses the runner-up concept, "Atšokimas": a court from above with the ball bouncing along a Z (`index.vue`, static under reduced motion).

### Installable app (PWA)

`@vite-pwa/nuxt`, configured in the `pwa` block of `nuxt.config.ts`. `<NuxtPwaManifest />` in `app.vue` links the manifest (without it browsers never offer to install), and the module's client plugin registers the service worker. Rules for the service worker, all for a server-rendered app on Vercel:
- No navigation fallback (`navigateFallback: null`): there is no prebuilt index.html, and a fallback to an unprecached URL breaks the worker.
- Only icons are precached. Build chunks and fonts (`/_nuxt/`, hashed) are cache-first in a long-lived runtime cache, so a page cached before a deploy still finds its chunks: each deploy replaces the precache and Vercel stops serving old files. `/_nuxt/builds/` (the mutable app-version manifest) is excluded.
- Pages and `/api/availability` are network-first with no timeout: the cache answers only without a network. The page then says it is offline, shows the data's date when it isn't today, and refetches when the kept page carries another day's data.
- `registerType: 'prompt'` with no prompt UI: a new worker takes over the next time the app is opened, instead of reloading open pages.
- Setting `workbox.globPatterns` replaces Workbox's defaults.

`app/components/InstallButton.vue` puts "Įdiegti" in the header on phones (never inside the installed app): Chrome/Android's own prompt via `$pwa.install()`, or Share-menu steps on iPhone/iPad (any browser since iOS 16.4). `public/screenshot-*.png` are the manifest's install-dialog screenshots.

### Deployment

```bash
npx vercel --prod --yes
```

The cron job (`CRON_SECRET` env var) is called every 5 minutes by the cf-proxy Worker's cron trigger (`cf-proxy/wrangler.toml`, `scheduled` in `cf-proxy/src/worker.ts`; the Worker needs `CRON_SECRET` as a secret too) and logs failed/carried-over venues (`wrangler tail`). Deploying the Worker (`cd cf-proxy && npx wrangler deploy`) installs the schedule; it needs `npx wrangler secret put CRON_SECRET` once, with the same value as the app's `CRON_SECRET` on Vercel, and `APP_URL` in `wrangler.toml` must point at production. `.github/workflows/scrape-cron.yml` is a manual-only fallback that annotates the run with failing venues — no Vercel Cron configuration needed.
