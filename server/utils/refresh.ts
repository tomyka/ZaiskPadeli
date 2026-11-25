import { STALE_TTL_SEC, setCached } from './cache'
import { VENUE_ERROR, scrapeAllVenues } from './scraper-all'
import type { AvailabilityResponse, Venue } from './types'

export interface RefreshResult {
  data: AvailabilityResponse
  /** Venues whose scrape failed but which still show their last good courts */
  carried: string[]
}

// One refresh per date at a time on this instance: user requests and the cron share it
const inflight = new Map<string, Promise<RefreshResult>>()

/**
 * Stand in for venues whose scrape failed with their last good courts, so one upstream
 * blip doesn't wipe a venue (or, on a network outage, every venue) from the cache.
 *
 * Age is judged by each venue's own `lastUpdated`, not the cache entry's, so data that
 * was already carried over is never stretched past the stale window.
 * Only `failed` venues are replaced — an empty day (`VENUE_ERROR.empty`) is a real answer.
 */
export function carryOverFailedVenues(
  fresh: Venue[],
  previous: Venue[] | undefined,
  now = Date.now(),
): { venues: Venue[]; carried: string[] } {
  const prevById = new Map((previous ?? []).map(v => [v.id, v]))
  const carried: string[] = []

  const venues = fresh.map((venue): Venue => {
    if (venue.error !== VENUE_ERROR.failed) return venue
    const prev = prevById.get(venue.id)
    if (!prev || prev.error || prev.courts.length === 0) return venue
    const age = now - Date.parse(prev.lastUpdated)
    if (!Number.isFinite(age) || age > STALE_TTL_SEC * 1000) return venue

    carried.push(venue.id)
    const { error: _error, ...rest } = venue
    return { ...rest, courts: prev.courts, lastUpdated: prev.lastUpdated, carriedOver: true }
  })

  return { venues, carried }
}

/**
 * Scrape every venue for `date`, keep last good data for venues that failed,
 * and store the result. Never throws for venue failures (runScraper absorbs them).
 * Concurrent calls for the same date share one scrape.
 */
export function refreshAvailability(date: string, previous?: AvailabilityResponse): Promise<RefreshResult> {
  const existing = inflight.get(date)
  if (existing) return existing
  const promise = scrapeAndStore(date, previous).finally(() => inflight.delete(date))
  inflight.set(date, promise)
  return promise
}

async function scrapeAndStore(date: string, previous?: AvailabilityResponse): Promise<RefreshResult> {
  const { venues, carried } = carryOverFailedVenues(await scrapeAllVenues(date), previous?.venues)
  if (carried.length) console.warn(`[refresh] ${date}: kept last good data for ${carried.join(', ')}`)

  const data: AvailabilityResponse = {
    date,
    venues,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
    cacheAgeSeconds: 0,
  }
  await setCached(date, data)
  return { data, carried }
}
