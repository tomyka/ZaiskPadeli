import { getCached } from '../utils/cache'
import { refreshAvailability } from '../utils/refresh'
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

  // 2. Scrape (shared with concurrent requests and the cron); venues that fail
  //    keep their last good courts from the stale entry
  const { data } = await refreshAvailability(date, cached?.data)
  return data
})
