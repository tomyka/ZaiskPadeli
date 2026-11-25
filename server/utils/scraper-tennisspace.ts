import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { fetchNTennisGrid } from './ntennis-fetch'
import { currentMinutesFor } from './time'

/** Tennis Space Kaunas — nTennis/nSoft platform (guest login) */
export async function scrapeTennisSpace(date: string, venue: { id: string }): Promise<Court[]> {
  const html = await fetchNTennisGrid({
    baseUrl: 'https://savitarna.tennisspace.lt',
    placeId: 4,
    // Public guest credentials visible in the login page source
    fallbackGuest: {
      login: '1arAQhwrzwdEjuCtobqyvVUtf5FCLJBPfw4yxmeb6d',
      password: 'jMkJE8b8Pjcvs5ncD0CKtNZTu9TP5Kq4T9aL04u9Yw',
    },
  }, date)
  return parseNTennisGrid(html, { idPrefix: venue.id, currentMinutes: currentMinutesFor(date) })
}
