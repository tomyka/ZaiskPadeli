import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { fetchNTennisGrid } from './ntennis-fetch'
import { currentMinutesFor } from './time'

/** A1Padel Klaipėda — nTennis/nSoft platform (guest login) */
export async function scrapeA1Padel(date: string, venue: { id: string }): Promise<Court[]> {
  const html = await fetchNTennisGrid({
    baseUrl: 'https://savitarna.a1padel.lt',
    placeId: 1,
    // Public guest credentials visible in the login page source
    fallbackGuest: { login: 'A1 Padel', password: 'ciDERedrU3wlfrekacHo' },
  }, date)
  return parseNTennisGrid(html, { idPrefix: venue.id, nameFromSpan: true, currentMinutes: currentMinutesFor(date) })
}
