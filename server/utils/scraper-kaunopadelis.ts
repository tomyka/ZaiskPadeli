import { load } from 'cheerio'
import type { Venue } from './types'
import { extractSetCookies, mergeCookies } from './cookies'
import { parseNTennisGrid } from './ntennis'
import { currentMinutesFor } from './time'

/**
 * Kauno Padelio Klubas — nTennis/nSoft platform
 *
 * This site is behind Cloudflare which blocks Vercel datacenter IPs.
 * When CF_PROXY_URL + CF_PROXY_TOKEN env vars are set, fetches grid HTML
 * through a Cloudflare Worker proxy (cf-proxy/) that bypasses the challenge.
 * Falls back to direct fetch when proxy is unavailable.
 */

const BASE_URL = 'https://savitarna.kaunopadelis.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeKaunoPadelis(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'kaunopadelis',
    name: 'Kauno Padelio Klubas',
    address: 'Lyderystės g. 6, Kaunas',
    city: 'Kaunas',
    bookingUrl: `${BASE_URL}/reservation/short`,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Try Cloudflare Worker proxy first (bypasses bot challenge)
    const html = await fetchGridHtml(date)
    if (!html) {
      venue.error = 'Nepavyko gauti rezervacijos duomenų'
      return venue
    }
    parseGrid(html, venue, date)
  } catch (err) {
    console.warn('[kaunopadelis] scrape failed:', (err as Error).message)
    venue.error = 'Failed to fetch Kauno Padelio Klubas data'
  }

  return venue
}

/** Try CF Worker proxy, fall back to direct fetch (local dev only) */
async function fetchGridHtml(date: string): Promise<string | null> {
  const proxyUrl = process.env.CF_PROXY_URL
  const proxyToken = process.env.CF_PROXY_TOKEN

  // ── Proxy path ──
  if (proxyUrl && proxyToken) {
    try {
      const url = `${proxyUrl}?site=kaunopadelis&date=${date}`
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${proxyToken}` },
      })
      if (resp.ok) {
        const data = (await resp.json()) as {
          html?: string
          error?: string
          status?: number
          loginStatus?: number
        }
        if (data.html && data.html.includes('booking-slot')) {
          return data.html
        }
        // Proxy returned but no usable booking data — log details for diagnosis
        console.warn('[kaunopadelis] Proxy returned no booking data', {
          hasHtml: !!data.html,
          htmlLength: data.html?.length ?? 0,
          proxyStatus: data.status,
          loginStatus: data.loginStatus,
          proxyError: data.error,
          hasCfChallenge: data.html?.includes('Just a moment') || data.html?.includes('cf-browser-verification'),
          hasLoginForm: data.html?.includes('LoginForm'),
        })
      } else {
        console.warn('[kaunopadelis] Proxy HTTP error', { status: resp.status })
      }
    } catch (e) {
      console.warn('[kaunopadelis] Proxy fetch threw', (e as Error).message)
    }
    // Proxy is configured — do NOT fall back to direct fetch.
    // Vercel datacenter IPs are blocked by Cloudflare; direct fetch will always fail.
    return null
  }

  // ── Direct path (local dev only — blocked by Cloudflare on Vercel) ──
  return await fetchGridDirect(date)
}

async function fetchGridDirect(date: string): Promise<string | null> {
  // Step 1: GET login page
  const loginResp = await fetch(`${BASE_URL}/user/login`, {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  const loginHtml = await loginResp.text()
  let cookies = extractSetCookies(loginResp.headers)

  const $login = load(loginHtml)
  const csrf = $login('input[name="YII_CSRF_TOKEN"]').first().attr('value')
  const guestLogin = $login('input[type="hidden"][name="LoginForm[var_login]"]').first().attr('value')
  const guestPass = $login('input[type="hidden"][name="LoginForm[var_password]"]').first().attr('value')

  const login = guestLogin || process.env.KAUNOPADELIS_LOGIN || ''
  const pass = guestPass || process.env.KAUNOPADELIS_PASSWORD || ''

  // Step 2: POST guest login
  const bodyParams: Record<string, string> = {
    'LoginForm[var_login]': login,
    'LoginForm[var_password]': pass,
  }
  if (csrf) bodyParams['YII_CSRF_TOKEN'] = csrf

  const postResp = await fetch(`${BASE_URL}/user/login`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
      'Accept-Language': 'lt,en;q=0.5',
      'Cookie': cookies.join('; '),
      'Referer': `${BASE_URL}/user/login`,
    },
    body: new URLSearchParams(bodyParams).toString(),
    redirect: 'manual',
  })
  cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

  if (postResp.status === 200) return null // login failed

  const location = postResp.headers.get('location')
  if (location) {
    const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
    const rResp = await fetch(redirectUrl, {
      headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') },
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractSetCookies(rResp.headers))
  }

  // Step 3: GET reservation grid
  const gridResp = await fetch(
    `${BASE_URL}/reservation/short?iPlaceId=1&sDate=${date}`,
    {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html',
        'Accept-Language': 'lt,en;q=0.5',
        'Cookie': cookies.join('; '),
      },
      redirect: 'manual',
    }
  )

  if (gridResp.status >= 300) return null

  const html = await gridResp.text()

  if (html.includes('Just a moment') || html.includes('cf-browser-verification')) {
    return null // Cloudflare challenge
  }
  if (html.includes('LoginForm') && !html.includes('booking-slot')) {
    return null // still on login page
  }
  if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
    return null // no booking data
  }

  return html
}

/** Parse nTennis grid HTML into venue courts */
function parseGrid(html: string, venue: Venue, date: string): void {
  venue.courts = parseNTennisGrid(html, { idPrefix: 'kaunopadelis', currentMinutes: currentMinutesFor(date) })
  if (venue.courts.length === 0) {
    venue.error = 'Rezervacijos duomenys neprieinami'
  }
}
