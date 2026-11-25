import { load } from 'cheerio'
import type { Venue } from './types'
import { extractSetCookies, mergeCookies } from './cookies'
import { parseNTennisGrid } from './ntennis'
import { currentMinutesFor } from './time'

/**
 * Tennis Space — nTennis/nSoft platform (Yii PHP)
 * Requires guest auto-login: GET login page → extract CSRF + hidden creds → POST login → GET reservation grid
 */

const BASE_URL = 'https://savitarna.tennisspace.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeTennisSpace(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'tennisspace',
    name: 'Tennis Space',
    address: 'Islandijos pl. 9C, Kaunas',
    city: 'Kaunas',
    bookingUrl: `${BASE_URL}/reservation/short?iPlaceId=4`,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Step 1: GET login page
    const loginResp = await fetch(`${BASE_URL}/user/login`, {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    })
    const loginHtml = await loginResp.text()
    let cookies = extractSetCookies(loginResp.headers)

    const $login = load(loginHtml)
    const csrf = $login('input[name="YII_CSRF_TOKEN"]').first().attr('value')
    // Guest creds are in a second form with type="hidden" — must filter by type
    const guestLogin = $login('input[type="hidden"][name="LoginForm[var_login]"]').first().attr('value')
    const guestPass = $login('input[type="hidden"][name="LoginForm[var_password]"]').first().attr('value')

    // Fallback: public guest credentials visible in source HTML
    const login = guestLogin || '1arAQhwrzwdEjuCtobqyvVUtf5FCLJBPfw4yxmeb6d'
    const pass = guestPass || 'jMkJE8b8Pjcvs5ncD0CKtNZTu9TP5Kq4T9aL04u9Yw'

    if (!csrf) {
      venue.error = 'Could not extract CSRF token from login page'
      return venue
    }

    // Step 2: POST guest login
    const body = new URLSearchParams({
      'YII_CSRF_TOKEN': csrf,
      'LoginForm[var_login]': login,
      'LoginForm[var_password]': pass,
    })

    const postResp = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': `${BASE_URL}/user/login`,
      },
      body: body.toString(),
      redirect: 'manual',
    })

    cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

    // Follow redirect if needed
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
      `${BASE_URL}/reservation/short?iPlaceId=4&sDate=${date}`,
      { headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') }, redirect: 'manual' }
    )

    if (gridResp.status >= 300 && gridResp.status < 400) {
      venue.error = 'Session expired — grid redirected to login'
      return venue
    }

    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed — still on login page'
      return venue
    }

    if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
      venue.error = 'Grid page loaded but contains no booking data'
      return venue
    }

    venue.courts = parseNTennisGrid(html, { idPrefix: 'tennisspace', currentMinutes: currentMinutesFor(date) })
  } catch (err) {
    console.warn('[tennisspace] scrape failed:', (err as Error).message)
    venue.error = 'Failed to fetch Tennis Space data'
  }

  return venue
}
