import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { fetchNTennisGrid } from './ntennis-fetch'
import { currentMinutesFor } from './time'

/** Vilnius Padel Arena — nTennis/nSoft platform (guest login) */
export async function scrapeVilniusPadel(date: string, venue: { id: string }): Promise<Court[]> {
  const html = await fetchNTennisGrid({
    baseUrl: 'https://rezervacijos.vilniuspadel.lt',
    placeId: 1,
    // Public guest credentials visible in the login page source
    fallbackGuest: { login: 'Rezervacija', password: 'PadelClubA22024' },
  }, date)
  return parseNTennisGrid(html, { idPrefix: venue.id, currentMinutes: currentMinutesFor(date) })
}
