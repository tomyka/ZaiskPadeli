import type { Court, Venue } from './types'
import { VENUES, type VenueId, type VenueInfo } from './venues'
import { byDayTime } from './time'
import { scrapePadelHub } from './scraper-padelhub'
import { scrapePadelHouse } from './scraper-padelhouse'
import { scrapeTennisSpace } from './scraper-tennisspace'
import { scrapeKaunoPadelis } from './scraper-kaunopadelis'
import { scrapeVilniusPadel } from './scraper-vilniuspadel'
import { scrapeA1Padel } from './scraper-a1padel'
import { scrapeSimonas } from './scraper-simonas'
import { scrapePrienuose } from './scraper-prienuose'
import { scrapePadel4u } from './scraper-padel4u'
import { wineroScraper } from './scraper-winero'
import { scrapeGoPadel } from './scraper-gopadel'
import { scrapePadelin } from './scraper-padelin'
import { mooveScraper } from './scraper-moove'
import { ntennisScraper } from './scraper-ntennis'

/**
 * A scraper fetches one venue's courts for a date.
 * It throws on any failure; the runner below records that as `status: 'failed'`.
 * Courts may omit `indoor`; the registry default is applied.
 */
export type Scraper = (date: string, venue: VenueInfo) => Promise<Court[]>

/** Every venue in the registry must have a scraper — enforced by this Record type. */
export const SCRAPERS: Record<VenueId, Scraper> = {
  padelhub: scrapePadelHub,
  padelhouse: scrapePadelHouse,
  tennisspace: scrapeTennisSpace,
  kaunopadelis: scrapeKaunoPadelis,
  padel4u: scrapePadel4u,
  vilniuspadel: scrapeVilniusPadel,
  a1padel: scrapeA1Padel,
  simonas: scrapeSimonas,
  kpadel: mooveScraper({ locationId: 227 }),
  prienuose: scrapePrienuose,
  zirmunai: wineroScraper({ arenaId: 'a77b94b4-46c0-4e7b-b69d-2ed700d3e483' }),
  padelfactory: wineroScraper({ arenaId: '6526ba41-0328-4562-9da0-c8708f2e42ec', skipCourts: ['kamuoliukų mašina', 'ball machine'] }),
  vilmers: wineroScraper({ arenaId: 'c389edb7-7e41-4e2e-bcb2-a6157cdcfc97' }),
  minija: wineroScraper({ arenaId: 'fdaf2d26-fee7-482d-a555-75140ba59999' }),
  gopadel: scrapeGoPadel,
  padelin: scrapePadelin,
  bsportklaipeda: ntennisScraper({ baseUrl: 'https://savitarna.bsport.lt', placeId: 2 }),
  skycop: ntennisScraper({ baseUrl: 'https://savitarna.padelionamai.lt', placeId: 4 }),
  padelionamai: ntennisScraper({ baseUrl: 'https://savitarna.padelionamai.lt', placeId: 2 }),
  drevernos: mooveScraper({ locationId: 288, indoor: true }),
  startpadel: mooveScraper({ locationId: 158, indoor: true }),
}

/** Hard cap per venue so one hanging upstream can't stall the whole response.
 *  Must exceed the slowest legitimate path: nTennis guest login = 4 sequential 8 s steps. */
const VENUE_DEADLINE_MS = 40_000

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
}

/** Run one venue's scraper and wrap the result (or failure) into a Venue. Never throws. */
export async function runScraper(
  info: VenueInfo,
  scrape: Scraper,
  date: string,
  deadlineMs = VENUE_DEADLINE_MS,
): Promise<Venue> {
  const venue: Venue = {
    id: info.id,
    name: info.name,
    address: info.address,
    municipality: info.municipality,
    bookingUrl: info.bookingUrl,
    courts: [],
    lastUpdated: new Date().toISOString(),
    status: 'ok',
  }

  try {
    const courts = await withDeadline(scrape(date, info), deadlineMs)
    // Normalise here so every consumer can rely on venue-day slot order (see TimeSlot)
    venue.courts = courts.map(c => ({
      ...c,
      indoor: c.indoor ?? info.indoor,
      slots: [...c.slots].sort((a, b) => byDayTime(a.time, b.time)),
    }))
    if (venue.courts.length === 0) venue.status = 'empty'
  } catch (err) {
    console.warn(`[${info.id}] scrape failed for ${date}:`, (err as Error).message)
    venue.status = 'failed'
  }

  return venue
}

/**
 * Scrape all venues in parallel. A single venue failure never blocks the others.
 */
export function scrapeAllVenues(date: string): Promise<Venue[]> {
  return Promise.all(VENUES.map(info => runScraper(info, SCRAPERS[info.id], date)))
}
