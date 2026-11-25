import { useAvailabilityStore } from '../../utils/availability-store'
import { nextDatesLT } from '../../utils/time'
import type { ScrapeReport } from '../../utils/types'

/**
 * Cron endpoint: pre-scrapes today + the next 2 days and stores them in KV.
 * Called every 5 minutes by the cf-proxy Worker's cron trigger (cf-proxy/src/worker.ts);
 * the GitHub Actions workflow (.github/workflows/scrape-cron.yml) is a manual fallback.
 * Protected by CRON_SECRET to prevent external abuse.
 *
 * Response per date: `failed` = venues with no bookable data (failed or empty day), `carried` = venues whose scrape
 * failed but still show their last good data (see availability-store.ts).
 */
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  const cronSecret = process.env.CRON_SECRET

  // Fail closed in production: a missing secret must not open the endpoint to anyone.
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 500, message: 'CRON_SECRET not configured' })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const dates = nextDatesLT(3)
  const results: Record<string, ScrapeReport> = {}

  for (const date of dates) {
    const start = Date.now()
    const { data, carried } = await useAvailabilityStore().refresh(date)
    const failed = data.venues.filter(v => v.status === 'failed' || v.status === 'empty').map(v => v.id)
    results[date] = { venues: data.venues.length, errors: failed.length, failed, carried, ms: Date.now() - start }
  }

  return {
    ok: true,
    scraped: dates.length,
    results,
    timestamp: new Date().toISOString(),
  }
})
