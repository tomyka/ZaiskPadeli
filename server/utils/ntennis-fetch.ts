import { extractSetCookies, mergeCookies } from './cookies'

/**
 * Guest-session fetch for nTennis/nSoft (Yii) booking sites.
 *
 * These sites only show the reservation grid to a logged-in user, but the login
 * page embeds a public "guest" account in hidden inputs:
 *   GET /user/login → read CSRF + hidden guest creds → POST /user/login
 *   → follow redirect → GET /reservation/short?iPlaceId=N&sDate=YYYY-MM-DD
 *
 * RUNTIME-AGNOSTIC: imported by the Nitro server AND bundled into the Cloudflare
 * Worker (cf-proxy/src/worker.ts). Use only web-standard APIs here (fetch, Headers,
 * URLSearchParams, AbortSignal) — no cheerio, no Node built-ins, no Nitro auto-imports.
 *
 * Pair with the pure parser in ntennis.ts.
 */

export interface NTennisSite {
  baseUrl: string
  placeId: number
  /** Used only if the login page stops exposing hidden guest creds */
  fallbackGuest?: { login: string; password: string }
}

export interface NTennisGridResult {
  /** Grid page HTML ('' if the grid request was redirected) */
  html: string
  /** HTTP status of the grid request */
  status: number
  /** HTTP status of the login POST (302 = accepted) */
  loginStatus: number
  /** Login POST answered 200 without a redirect — the site rejected the credentials */
  loginRejected: boolean
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const STEP_TIMEOUT_MS = 8_000 // up to 4 sequential steps — keep 4 × this under VENUE_DEADLINE_MS (scraper-all.ts)

/** Shared wording so server logs and proxy responses say the same thing */
export const LOGIN_REJECTED = 'Login rejected by site — guest credentials not accepted'

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : ENTITIES[e.toLowerCase()] ?? m)
}

/** Attributes of one start tag: double-, single- or un-quoted values; names lower-cased; entities decoded. */
function parseAttributes(tag: string): Map<string, string> {
  const attrs = new Map<string, string>()
  const body = tag.replace(/^<\w+/, '').replace(/\/?>$/, '')
  for (const m of body.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs.set(m[1]!.toLowerCase(), decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''))
  }
  return attrs
}

/**
 * Value of the first <input name="…"> with a non-empty value. `hiddenOnly` skips visible inputs.
 * A tiny tag-attribute parser instead of cheerio, so this module stays runtime-agnostic.
 */
export function extractInputValue(html: string, name: string, hiddenOnly = false): string | undefined {
  for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag)
    if (attrs.get('name') !== name) continue
    if (hiddenOnly && attrs.get('type')?.toLowerCase() !== 'hidden') continue
    const value = attrs.get('value')
    if (value) return value
  }
  return undefined
}

/** Throws with a diagnostic reason unless `html` is a usable reservation grid. */
export function assertGridHtml(html: string): void {
  if (html.includes('Just a moment') || html.includes('cf-browser-verification')) {
    throw new Error('Cloudflare challenge page')
  }
  if (html.includes('LoginForm') && !html.includes('booking-slot')) {
    throw new Error('Guest login failed — still on login page')
  }
  if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
    throw new Error('Grid page contains no booking data')
  }
}

/**
 * Log in as the site's guest and GET the grid, returning raw results + diagnostics.
 * Does not judge the HTML — callers decide (see fetchNTennisGrid / the proxy worker).
 * Throws only on network errors and timeouts.
 */
export async function loginAndFetchGrid(site: NTennisSite, date: string): Promise<NTennisGridResult> {
  const { baseUrl } = site
  const request = (url: string, init: RequestInit & { cookies?: string[] } = {}) => {
    const { cookies, headers, ...rest } = init
    return fetch(url, {
      ...rest,
      redirect: 'manual',
      signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html',
        'Accept-Language': 'lt,en;q=0.5',
        ...(cookies?.length ? { Cookie: cookies.join('; ') } : {}),
        ...headers,
      },
    })
  }

  // 1. Login page: session cookie, CSRF token, hidden guest credentials
  const loginResp = await request(`${baseUrl}/user/login`)
  let cookies = extractSetCookies(loginResp.headers)
  const loginHtml = await loginResp.text()
  const csrf = extractInputValue(loginHtml, 'YII_CSRF_TOKEN')
  // Guest creds sit in a second form with type="hidden" — must filter by type
  const login = extractInputValue(loginHtml, 'LoginForm[var_login]', true) || site.fallbackGuest?.login || ''
  const password = extractInputValue(loginHtml, 'LoginForm[var_password]', true) || site.fallbackGuest?.password || ''

  // 2. Log in as guest — success answers with a redirect
  const body = new URLSearchParams({ 'LoginForm[var_login]': login, 'LoginForm[var_password]': password })
  if (csrf) body.set('YII_CSRF_TOKEN', csrf)
  const postResp = await request(`${baseUrl}/user/login`, {
    method: 'POST',
    cookies,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `${baseUrl}/user/login` },
    body: body.toString(),
  })
  cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

  const location = postResp.headers.get('location')
  if (postResp.status === 200 && !location) {
    // Login form re-rendered: credentials rejected — the grid would only redirect to login
    return { html: '', status: postResp.status, loginStatus: postResp.status, loginRejected: true }
  }
  if (location) {
    const redirectResp = await request(location.startsWith('http') ? location : `${baseUrl}${location}`, { cookies })
    cookies = mergeCookies(cookies, extractSetCookies(redirectResp.headers))
  }

  // 3. Reservation grid
  const gridResp = await request(`${baseUrl}/reservation/short?iPlaceId=${site.placeId}&sDate=${date}`, { cookies })
  const redirected = gridResp.status >= 300 && gridResp.status < 400
  return {
    html: redirected ? '' : await gridResp.text(),
    status: gridResp.status,
    loginStatus: postResp.status,
    loginRejected: false,
  }
}

/**
 * Throws with a diagnostic reason unless a grid fetch (here or through the cf-proxy Worker)
 * produced a usable grid; returns its HTML. Older Worker builds report a rejected login
 * as `error: LOGIN_REJECTED` instead of `loginRejected`.
 */
export function usableGridHtml(result: Pick<NTennisGridResult, 'html' | 'status'> & { loginRejected?: boolean; error?: string }): string {
  if (result.loginRejected || result.error === LOGIN_REJECTED) throw new Error(LOGIN_REJECTED)
  if (result.status >= 300 && result.status < 400) {
    throw new Error(`Grid redirected (HTTP ${result.status}) — session not established`)
  }
  if (result.status >= 400) throw new Error(`Grid HTTP ${result.status}`)
  assertGridHtml(result.html)
  return result.html
}

/** Server-side convenience: log in, fetch the grid, and throw unless it is usable. */
export async function fetchNTennisGrid(site: NTennisSite, date: string): Promise<string> {
  return usableGridHtml(await loginAndFetchGrid(site, date))
}
