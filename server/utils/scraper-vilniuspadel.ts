import { load } from 'cheerio'
import type { Venue } from './types'
import { extractSetCookies, mergeCookies } from './cookies'
import { parseNTennisGrid } from './ntennis'
import { currentMinutesFor } from './time'

/**
 * Vilnius Padel Arena — nTennis/nSoft platform
 * Guest auto-login: GET login → extract hidden creds → POST → GET reservation grid
 */

const BASE_URL = 'https://rezervacijos.vilniuspadel.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeVilniusPadel(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'vilniuspadel',
    name: 'Vilnius Padel Arena',
    address: 'Žygio g. 97A, Vilnius',
    city: 'Vilnius',
    bookingUrl: `${BASE_URL}/reservation/short`,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Step 1: GET login page — extract hidden guest credentials
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

    // Fallback: public guest credentials visible in source HTML
    const login = guestLogin || 'Rezervacija'
    const pass = guestPass || 'PadelClubA22024'

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
        'Cookie': cookies.join('; '),
        'Referer': `${BASE_URL}/user/login`,
      },
      body: new URLSearchParams(bodyParams).toString(),
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

    const location = postResp.headers.get('location')
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
      const redirectResp = await fetch(redirectUrl, {
        headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') },
        redirect: 'manual',
      })
      cookies = mergeCookies(cookies, extractSetCookies(redirectResp.headers))
    }

    // Step 3: GET reservation grid
    const gridResp = await fetch(
      `${BASE_URL}/reservation/short?iPlaceId=1&sDate=${date}`,
      { headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') }, redirect: 'manual' }
    )

    if (gridResp.status >= 300 && gridResp.status < 400) {
      venue.error = 'Session expired — grid redirected to login'
      return venue
    }

    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed'
      return venue
    }

    if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
      venue.error = 'Grid page loaded but contains no booking data'
      return venue
    }

    venue.courts = parseNTennisGrid(html, { idPrefix: 'vilniuspadel', currentMinutes: currentMinutesFor(date) })
  } catch (err) {
    console.warn('[vilniuspadel] scrape failed:', (err as Error).message)
    venue.error = 'Failed to fetch Vilnius Padel Arena data'
  }

  return venue
}
