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
 */

import { LOGIN_REJECTED, loginAndFetchGrid, type NTennisSite } from '../../server/utils/ntennis-fetch'

interface Env {
  PROXY_TOKEN: string
  KAUNOPADELIS_LOGIN: string
  KAUNOPADELIS_PASSWORD: string
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
    const siteFor = SITES[site]
    if (!siteFor) {
      return json({ error: `Unknown site: ${site}` }, 400)
    }

    try {
      const { html, status, loginStatus, loginRejected } = await loginAndFetchGrid(siteFor(env), date)
      return json({ html, status, loginStatus, ...(loginRejected ? { error: LOGIN_REJECTED } : {}) })
    } catch (err: any) {
      return json({ error: err?.message ?? 'Unknown error' }, 500)
    }
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
