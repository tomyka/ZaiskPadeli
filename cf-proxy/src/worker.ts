/**
 * Cloudflare Worker proxy for Cloudflare-protected nTennis booking sites.
 *
 * Workers run on Cloudflare's edge network and are not subject to the same
 * bot-challenge rules that block datacenter IPs (like Vercel's).
 *
 * Flow: Vercel app → this Worker → kaunopadelis.lt → grid HTML → Vercel app
 * The Vercel scraper (server/utils/scraper-kaunopadelis.ts) parses the HTML.
 *
 * The guest-login flow itself is shared with the server: wrangler bundles
 * server/utils/ntennis-fetch.ts (runtime-agnostic, web APIs only) into this Worker.
 * This file only handles auth, the site table, credentials and the response.
 *
 * Response contract (consumed by scraper-kaunopadelis.ts):
 *   200 { html, status, loginStatus, error? }   — html is '' when login/grid failed
 *   4xx/5xx { error }
 *
 * The Worker also owns the cache pre-warm schedule: its cron trigger (wrangler.toml)
 * calls the app's /api/cron/scrape — see `scheduled` below.
 */

import { LOGIN_REJECTED, loginAndFetchGrid, type NTennisSite } from '../../server/utils/ntennis-fetch'
import type { ScrapeReport } from '../../server/utils/types'
import { fetchGoPadelDay } from '../../server/utils/gopadel-fetch'

interface Env {
  PROXY_TOKEN: string
  KAUNOPADELIS_LOGIN: string
  KAUNOPADELIS_PASSWORD: string
  /** Base URL of the app whose cache the cron pre-warms ([vars] in wrangler.toml) */
  APP_URL: string
  /** Same value as the app's CRON_SECRET */
  CRON_SECRET: string
}

/** Under the 5-minute schedule, so a hung run can't overlap the next one */
const SCRAPE_TIMEOUT_MS = 4 * 60_000

/**
 * Pre-warm the app's availability cache. Throws on failure — including a date where every
 * venue errors with nothing carried over (an outage) — so the run shows as failed in the dashboard.
 */
async function triggerScrape(env: Env): Promise<void> {
  if (!env.APP_URL || !env.CRON_SECRET) throw new Error('APP_URL or CRON_SECRET not configured')

  const resp = await fetch(`${env.APP_URL}/api/cron/scrape`, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  })
  if (!resp.ok) throw new Error(`Scrape returned HTTP ${resp.status}`)

  // Scraper-health canary, visible in `wrangler tail` and the Worker's logs
  const { results } = (await resp.json()) as { results: Record<string, ScrapeReport> }
  const outages: string[] = []
  for (const [date, r] of Object.entries(results)) {
    const line = `[cron] ${date} venues=${r.venues} errors=${r.errors} ms=${r.ms}`
    if (r.failed.length || r.carried.length) console.warn(`${line} failed=${r.failed.join(',')} carried=${r.carried.join(',')}`)
    else console.log(line)
    if (r.venues > 0 && r.errors === r.venues) outages.push(date)
  }
  if (outages.length) throw new Error(`Every venue failed for ${outages.join(', ')}`)
}

/** Sites this proxy may fetch, with credentials resolved from Worker secrets */
const SITES: Record<string, (env: Env) => NTennisSite> = {
  kaunopadelis: env => ({
    baseUrl: 'https://savitarna.kaunopadelis.lt',
    placeId: 1,
    fallbackGuest: { login: env.KAUNOPADELIS_LOGIN, password: env.KAUNOPADELIS_PASSWORD },
  }),
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const site = url.searchParams.get('site')
    const date = url.searchParams.get('date')

    // Auth: Bearer token or query param
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') ?? url.searchParams.get('token')

    if (!env.PROXY_TOKEN || token !== env.PROXY_TOKEN) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!site || !date) {
      return json({ error: 'Missing ?site= or ?date= parameter' }, 400)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'Invalid date, expected YYYY-MM-DD' }, 400)
    }
    // GO Padel (Alytus): JSON API behind Cloudflare; returns { facility, availability }
    if (site === 'gopadel') {
      try {
        return json(await fetchGoPadelDay(date))
      } catch (err: any) {
        console.warn(`[gopadel] fetch failed: ${err?.message}`)
        return json({ error: err?.message ?? 'Unknown error' }, 502)
      }
    }

    const siteFor = SITES[site]
    if (!siteFor) {
      return json({ error: `Unknown site: ${site}` }, 400)
    }

    try {
      const { html, status, loginStatus, loginRejected } = await loginAndFetchGrid(siteFor(env), date)
      if (!html.includes('booking-slot')) {
        // Visible in `wrangler tail` — the Vercel side only sees a generic venue error
        const colo = (request as { cf?: { colo?: string } }).cf?.colo
        const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
        console.warn(`[${site}] unusable grid: status=${status} login=${loginStatus} rejected=${loginRejected} len=${html.length} colo=${colo} title=${title}`)
      }
      return json({ html, status, loginStatus, ...(loginRejected ? { error: LOGIN_REJECTED } : {}) })
    } catch (err: any) {
      return json({ error: err?.message ?? 'Unknown error' }, 500)
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await triggerScrape(env)
  },
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
