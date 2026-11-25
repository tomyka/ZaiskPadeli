import { load } from 'cheerio'
import { extractSetCookies, mergeCookies } from './cookies'

/**
 * Guest-session fetch for nTennis/nSoft (Yii) booking sites.
 *
 * These sites only show the reservation grid to a logged-in user, but the login
 * page embeds a public "guest" account in hidden inputs:
 *   GET /user/login → read CSRF + hidden guest creds → POST /user/login
 *   → follow redirect → GET /reservation/short?iPlaceId=N&sDate=YYYY-MM-DD
 *
 * Pair with the pure parser in ntennis.ts.
 */

export interface NTennisSite {
  baseUrl: string
  placeId: number
  /** Used only if the login page stops exposing hidden guest creds */
  fallbackGuest?: { login: string; password: string }
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const STEP_TIMEOUT_MS = 8_000 // up to 4 sequential steps — keep 4 × this under VENUE_DEADLINE_MS (scraper-all.ts)

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

/** Log in as the site's guest and return the reservation grid HTML for `date`. */
export async function fetchNTennisGrid(site: NTennisSite, date: string): Promise<string> {
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
  const $login = load(await loginResp.text())
  const csrf = $login('input[name="YII_CSRF_TOKEN"]').first().attr('value')
  // Guest creds sit in a second form with type="hidden" — must filter by type
  const login = $login('input[type="hidden"][name="LoginForm[var_login]"]').first().attr('value')
    || site.fallbackGuest?.login || ''
  const password = $login('input[type="hidden"][name="LoginForm[var_password]"]').first().attr('value')
    || site.fallbackGuest?.password || ''

  // 2. Log in as guest
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
  if (location) {
    const redirectResp = await request(location.startsWith('http') ? location : `${baseUrl}${location}`, { cookies })
    cookies = mergeCookies(cookies, extractSetCookies(redirectResp.headers))
  }

  // 3. Reservation grid
  const gridResp = await request(`${baseUrl}/reservation/short?iPlaceId=${site.placeId}&sDate=${date}`, { cookies })
  if (gridResp.status >= 300 && gridResp.status < 400) throw new Error('Grid redirected — session not established')
  if (!gridResp.ok) throw new Error(`Grid HTTP ${gridResp.status}`)

  const html = await gridResp.text()
  assertGridHtml(html)
  return html
}
