import type { Court } from './types'
import { parseNTennisGrid } from './ntennis'
import { fetchNTennisGrid, type NTennisSite } from './ntennis-fetch'
import { fetchProtectedDay } from './protected-fetch'
import { currentMinutesFor } from './time'

/**
 * nTennis / nSoft booking sites (savitarna.*, rezervacij*.*): one scraper per place.
 *
 * The site's public guest login (hidden inputs on /user/login) is used; place ids are the
 * `iPlaceId` links on /reservation/short after logging in as that guest. `fallbackGuest`
 * is only for sites whose login page stops exposing those hidden inputs.
 * A site behind Cloudflare is named by its protected-sites.ts entry instead (`protected`).
 */
export type NTennisConfig = (NTennisSite | { protected: 'kaunopadelis' }) & {
  /** The court name is a <span> next to extra text (A1Padel) — read only that span */
  nameFromSpan?: boolean
}

export function ntennisScraper(config: NTennisConfig) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const html = 'protected' in config
      ? (await fetchProtectedDay(config.protected, date)).html // checked usable by fetchProtectedDay
      : await fetchNTennisGrid(config, date)
    return parseNTennisGrid(html, { idPrefix: venue.id, nameFromSpan: config.nameFromSpan, currentMinutes: currentMinutesFor(date) })
  }
}
