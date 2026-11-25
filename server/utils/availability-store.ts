import { kv } from '@vercel/kv'
import { scrapeAllVenues } from './scraper-all'
import type { AvailabilityResponse, Venue } from './types'

/**
 * The availability store: the one place that decides when a date's availability is
 * served from storage and when it is scraped again.
 *
 *   get(date)     — fresh stored data if there is some, otherwise a refresh
 *   refresh(date) — scrape now (shared with concurrent callers for the same date),
 *                   keeping the last good courts for venues whose scrape failed
 *
 * Policy:
 *   - stored data is fresh for FRESH_SEC, kept as a fallback for STALE_SEC
 *   - a venue whose scrape fails keeps its last good courts while they are under
 *     STALE_SEC old, judged by the venue's own `lastUpdated` (never stretched)
 *
 * Storage is a seam: Vercel KV in production, in memory locally and in tests.
 */

// Bump when the stored shape or its guarantees change
// (v2: slots in venue-day order; v3: venues carry municipality; v4: store owns stamping;
//  v5: venue status replaces error text + carriedOver)
const KEY_PREFIX = 'avail:v5'
const FRESH_SEC = 5 * 60
const STALE_SEC = 60 * 60

export interface StoredAvailability {
  venues: Venue[]
  /** epoch ms of the scrape */
  storedAt: number
}

export interface AvailabilityStorage {
  get(key: string): Promise<StoredAvailability | null>
  /** Keep for at least `ttlSec`; it may be dropped after that */
  set(key: string, value: StoredAvailability, ttlSec: number): Promise<void>
}

export interface RefreshResult {
  data: AvailabilityResponse
  /** Venues whose scrape failed but which still show their last good courts */
  carried: string[]
}

export interface AvailabilityStore {
  get(date: string): Promise<AvailabilityResponse>
  refresh(date: string): Promise<RefreshResult>
}

export function createAvailabilityStore(deps: {
  storage: AvailabilityStorage
  scrape: (date: string) => Promise<Venue[]>
  now?: () => number
}): AvailabilityStore {
  const { storage, scrape, now = Date.now } = deps
  const inflight = new Map<string, Promise<RefreshResult>>()
  const key = (date: string) => `${KEY_PREFIX}:${date}`

  /** Stored entry if still within the stale window */
  async function read(date: string): Promise<StoredAvailability | null> {
    const entry = await storage.get(key(date))
    if (!entry || now() - entry.storedAt > STALE_SEC * 1000) return null
    return entry
  }

  async function scrapeAndStore(date: string): Promise<RefreshResult> {
    const previous = await read(date)
    const { venues, carried } = carryOverFailedVenues(await scrape(date), previous?.venues, now())
    if (carried.length) console.warn(`[availability] ${date}: kept last good data for ${carried.join(', ')}`)
    const entry: StoredAvailability = { venues, storedAt: now() }
    await storage.set(key(date), entry, STALE_SEC + 60)
    return { data: respond(date, entry, false), carried }
  }

  function respond(date: string, entry: StoredAvailability, fromCache: boolean): AvailabilityResponse {
    return {
      date,
      venues: entry.venues,
      fetchedAt: new Date(entry.storedAt).toISOString(),
      fromCache,
      cacheAgeSeconds: fromCache ? Math.floor((now() - entry.storedAt) / 1000) : 0,
    }
  }

  const store: AvailabilityStore = {
    refresh(date) {
      const existing = inflight.get(date)
      if (existing) return existing
      const promise = scrapeAndStore(date).finally(() => inflight.delete(date))
      inflight.set(date, promise)
      return promise
    },
    async get(date) {
      const entry = await read(date)
      if (entry && now() - entry.storedAt <= FRESH_SEC * 1000) return respond(date, entry, true)
      return (await store.refresh(date)).data
    },
  }
  return store
}

/**
 * Stand in for venues whose scrape failed with their last good courts (status 'stale'),
 * so one upstream blip doesn't wipe a venue (or, on a network outage, every venue) from
 * the page. Only 'failed' venues are replaced — an empty day is a real answer.
 */
function carryOverFailedVenues(
  fresh: Venue[],
  previous: Venue[] | undefined,
  now: number,
): { venues: Venue[]; carried: string[] } {
  const prevById = new Map((previous ?? []).map(v => [v.id, v]))
  const carried: string[] = []

  const venues = fresh.map((venue): Venue => {
    if (venue.status !== 'failed') return venue
    const prev = prevById.get(venue.id)
    if (!prev || (prev.status !== 'ok' && prev.status !== 'stale') || prev.courts.length === 0) return venue
    const age = now - Date.parse(prev.lastUpdated)
    if (!Number.isFinite(age) || age > STALE_SEC * 1000) return venue

    carried.push(venue.id)
    return { ...venue, status: 'stale', courts: prev.courts, lastUpdated: prev.lastUpdated }
  })

  return { venues, carried }
}

// ── Storage adapters ────────────────────────────────────────────────────────

/** Vercel KV (Upstash Redis). Errors are logged and treated as a miss / a skipped write. */
export function kvAvailabilityStorage(): AvailabilityStorage {
  return {
    async get(k) {
      try { return await kv.get<StoredAvailability>(k) }
      catch (e) { console.warn('[availability] KV read error:', (e as Error).message); return null }
    },
    async set(k, value, ttlSec) {
      try { await kv.set(k, value, { ex: ttlSec }) }
      catch (e) { console.warn('[availability] KV write error:', (e as Error).message) }
    },
  }
}

/** In-process map for local dev and tests; keeps the newest `maxEntries`. */
export function memoryAvailabilityStorage(maxEntries = 30): AvailabilityStorage {
  const entries = new Map<string, StoredAvailability>()
  return {
    async get(k) { return entries.get(k) ?? null },
    async set(k, value) {
      entries.delete(k)
      entries.set(k, value)
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value!)
    },
  }
}

let shared: AvailabilityStore | undefined

/** The app's store: KV when its credentials are configured (production), memory otherwise. */
export function useAvailabilityStore(): AvailabilityStore {
  shared ??= createAvailabilityStore({
    storage: process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
      ? kvAvailabilityStorage()
      : memoryAvailabilityStorage(),
    scrape: scrapeAllVenues,
  })
  return shared
}
