import { getCached, setCached, getInflight, setInflight } from '../utils/cache'
import { scrapeAllVenues } from '../utils/scraper-all'
import { MAX_DAYS_AHEAD, addDays, isValidIsoDate, todayLT } from '../utils/time'
import type { AvailabilityResponse } from '../utils/types'

export default defineEventHandler(async (event): Promise<AvailabilityResponse> => {
  const query = getQuery(event)
  const today = todayLT()
  const date = typeof query.date === 'string' && query.date ? query.date : today

  // Strict date validation: format + real calendar date (rejects 2026-02-31)
  if (!isValidIsoDate(date)) {
    throw createError({ statusCode: 400, message: 'Invalid date. Use YYYY-MM-DD' })
  }
  // Bounded window: also caps how many distinct dates (cache keys / upstream scrapes)
  // an anonymous caller can trigger. Yesterday is allowed for clients just past midnight.
  if (date < addDays(today, -1) || date > addDays(today, MAX_DAYS_AHEAD)) {
    throw createError({ statusCode: 400, message: 'Date out of range' })
  }

  // 1. Serve from KV cache if fresh
  const cached = await getCached(date)
  if (cached && !cached.stale) {
    return { ...cached.data, fromCache: true, cacheAgeSeconds: cached.ageSeconds }
  }

  // 2. Deduplicate concurrent requests
  const existing = getInflight(date)
  if (existing) return existing

  // 3. Scrape fresh data (stale data available as fallback)
  const promise = (async (): Promise<AvailabilityResponse> => {
    try {
      const venues = await scrapeAllVenues(date)

      const result: AvailabilityResponse = {
        date,
        venues,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        cacheAgeSeconds: 0,
      }
      await setCached(date, result)
      return result
    } catch (e) {
      // If scraping fails entirely, serve stale data if available
      if (cached) {
        console.warn(`[availability] Scrape failed, serving stale data (${cached.ageSeconds}s old):`, (e as Error).message)
        return { ...cached.data, fromCache: true, cacheAgeSeconds: cached.ageSeconds }
      }
      throw e
    }
  })()

  setInflight(date, promise)
  return promise
})
