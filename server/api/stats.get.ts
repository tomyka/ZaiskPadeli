import { kv } from '@vercel/kv'
import { pastDatesLT } from '../utils/time'

/**
 * GET /api/stats — visitor statistics from Upstash Redis.
 * Returns total visits + last 30 days breakdown.
 */
export default defineEventHandler(async () => {
  if (!process.env.KV_REST_API_URL) {
    return { total: 0, today: 0, last30days: [], note: 'KV not available (local dev)' }
  }

  const dates = pastDatesLT(30)

  const keys = ['visits:total', ...dates.map(d => `visits:${d}`)]
  const values = await kv.mget<number[]>(...keys)

  const [total, ...dailyCounts] = values

  const last30days = dates.map((date, i) => ({
    date,
    visits: dailyCounts[i] ?? 0,
  }))

  return {
    total: total ?? 0,
    today: last30days[0]?.visits ?? 0,
    last30days,
  }
})
