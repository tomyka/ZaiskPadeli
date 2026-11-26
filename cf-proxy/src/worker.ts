/**
 * Cloudflare Worker proxy for booking sites behind Cloudflare.
 *
 * Workers run on Cloudflare's edge network and are not subject to the same
 * bot-challenge rules that block datacenter IPs (like Vercel's).
 *
 * Flow: Vercel app → this Worker → the booking site → raw day data → Vercel app
 * The sites and how each is fetched live in server/utils/protected-sites.ts (runtime-agnostic),
 * which wrangler bundles in here; the server calls this Worker from protected-fetch.ts,
 * which runs the same site entry's check on the answer. This file handles auth, secrets and logging.
 *
 * Response contract (consumed by server/utils/protected-fetch.ts):
 *   200 <the site entry's day data>   — kaunopadelis: { html, status, loginStatus, loginRejected }
 *                                       gopadel: { facility, availability }
 *   4xx/5xx { error }
 *
 * The Worker also owns the cache pre-warm schedule: its cron trigger (wrangler.toml)
 * calls the app's /api/cron/scrape — see `scheduled` below.
 */

import { isProtectedSiteId, PROTECTED_SITES } from '../../server/utils/protected-sites'
import type { ScrapeReport } from '../../server/utils/types'

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
    if (!isProtectedSiteId(site)) {
      return json({ error: `Unknown site: ${site}` }, 400)
    }

    const entry = PROTECTED_SITES[site] as { fetch: (date: string, secrets: (name: string) => string | undefined) => Promise<unknown>; check: (day: unknown) => void }
    try {
      const day = await entry.fetch(date, name => (env as unknown as Record<string, string | undefined>)[name])
      try {
        entry.check(day)
      } catch (err: any) {
        // Visible in `wrangler tail`; the app runs the same check and records the venue as failed
        const colo = (request as { cf?: { colo?: string } }).cf?.colo
        const html = (day as { html?: string }).html ?? ''
        const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim()
        console.warn(`[${site}] unusable day: ${err?.message} colo=${colo}${title ? ` title=${title}` : ''}`)
      }
      return json(day)
    } catch (err: any) {
      console.warn(`[${site}] fetch failed: ${err?.message}`)
      return json({ error: err?.message ?? 'Unknown error' }, 502)
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
