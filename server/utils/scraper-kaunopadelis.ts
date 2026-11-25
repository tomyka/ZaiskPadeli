import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { assertGridHtml, fetchNTennisGrid } from './ntennis-fetch'
import { currentMinutesFor } from './time'

/**
 * Kauno Padelio Klubas — nTennis/nSoft platform
 *
 * This site is behind Cloudflare, which blocks Vercel datacenter IPs.
 * When CF_PROXY_URL + CF_PROXY_TOKEN are set, the grid HTML is fetched through
 * the Cloudflare Worker proxy (cf-proxy/). Otherwise (local dev) it logs in directly.
 */
export async function scrapeKaunoPadelis(date: string, venue: { id: string }): Promise<Court[]> {
  const html = await fetchGridHtml(date)
  return parseNTennisGrid(html, { idPrefix: venue.id, currentMinutes: currentMinutesFor(date) })
}

async function fetchGridHtml(date: string): Promise<string> {
  const proxyUrl = process.env.CF_PROXY_URL
  const proxyToken = process.env.CF_PROXY_TOKEN

  // Proxy configured: never fall back to direct fetch — it always fails from Vercel IPs.
  if (proxyUrl && proxyToken) {
    const resp = await fetch(`${proxyUrl}?site=kaunopadelis&date=${date}`, {
      headers: { Authorization: `Bearer ${proxyToken}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`)
    const data = (await resp.json()) as { html?: string; error?: string; status?: number; loginStatus?: number }
    if (!data.html) {
      throw new Error(`Proxy returned no HTML (status=${data.status}, login=${data.loginStatus}, error=${data.error})`)
    }
    assertGridHtml(data.html)
    return data.html
  }

  return fetchNTennisGrid({
    baseUrl: 'https://savitarna.kaunopadelis.lt',
    placeId: 1,
    fallbackGuest: process.env.KAUNOPADELIS_LOGIN
      ? { login: process.env.KAUNOPADELIS_LOGIN, password: process.env.KAUNOPADELIS_PASSWORD ?? '' }
      : undefined,
  }, date)
}
