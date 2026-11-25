import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { fetchNTennisGrid } from './ntennis-fetch'
import { currentMinutesFor } from './time'

/**
 * Build a scraper for one place on an nTennis / nSoft site (savitarna.* booking sites).
 * The site's public guest login (hidden inputs on /user/login) is used; place ids are
 * the `iPlaceId` links on /reservation/short after logging in as that guest.
 */
export function ntennisScraper(config: { baseUrl: string; placeId: number; nameFromSpan?: boolean }) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const html = await fetchNTennisGrid({ baseUrl: config.baseUrl, placeId: config.placeId }, date)
    return parseNTennisGrid(html, { idPrefix: venue.id, nameFromSpan: config.nameFromSpan, currentMinutes: currentMinutesFor(date) })
  }
}
