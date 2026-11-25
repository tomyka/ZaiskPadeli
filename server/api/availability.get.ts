import { useAvailabilityStore } from '../utils/availability-store'
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

  return useAvailabilityStore().get(date)
})
