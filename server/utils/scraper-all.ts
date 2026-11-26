import type { Court, Venue } from './types'
import { VENUES, type VenueId, type VenueInfo } from './venues'
import { byDayTime } from './time'
import { scrapePadelHub } from './scraper-padelhub'
import { scrapePadelHouse } from './scraper-padelhouse'
import { scrapeSimonas } from './scraper-simonas'
import { scrapePrienuose } from './scraper-prienuose'
import { scrapePadel4u } from './scraper-padel4u'
import { scrapeGoPadel } from './scraper-gopadel'
import { scrapePadelin } from './scraper-padelin'
import { mooveScraper, type MooveConfig } from './scraper-moove'
import { ntennisScraper, type NTennisConfig } from './scraper-ntennis'
import { playballScraper } from './scraper-playball'
import { wineroScraper, type WineroArenaConfig } from './scraper-winero'

/**
 * A scraper fetches one venue's courts for a date.
 * It throws on any failure; the runner below records that as `status: 'failed'`.
 * Courts may omit `indoor`; the registry default is applied.
 */
export type Scraper = (date: string, venue: VenueInfo) => Promise<Court[]>

/**
 * How a venue is scraped: the booking platform it uses and that platform's ids, or `own`
 * for a club's one-off booking system. Kept here, not in venues.ts, because venues.ts is
 * bundled into the client and these carry platform credentials.
 */
export type ScraperSpec =
  | ({ platform: 'moove' } & MooveConfig)
  | ({ platform: 'ntennis' } & NTennisConfig)
  | ({ platform: 'winero' } & WineroArenaConfig)
  | { platform: 'playball'; slug: string }
  | { platform: 'own'; scrape: Scraper }

/** Every venue in the registry must have a scraper — enforced by this Record type. */
export const SCRAPERS: Record<VenueId, ScraperSpec> = {
  padelhub: { platform: 'own', scrape: scrapePadelHub },
  padelhouse: { platform: 'own', scrape: scrapePadelHouse },
  tennisspace: {
    platform: 'ntennis', baseUrl: 'https://savitarna.tennisspace.lt', placeId: 4,
    fallbackGuest: { login: '1arAQhwrzwdEjuCtobqyvVUtf5FCLJBPfw4yxmeb6d', password: 'jMkJE8b8Pjcvs5ncD0CKtNZTu9TP5Kq4T9aL04u9Yw' },
  },
  kaunopadelis: { platform: 'ntennis', protected: 'kaunopadelis' },
  padel4u: { platform: 'own', scrape: scrapePadel4u },
  vilniuspadel: {
    platform: 'ntennis', baseUrl: 'https://rezervacijos.vilniuspadel.lt', placeId: 1,
    fallbackGuest: { login: 'Rezervacija', password: 'PadelClubA22024' },
  },
  a1padel: {
    platform: 'ntennis', baseUrl: 'https://savitarna.a1padel.lt', placeId: 1, nameFromSpan: true,
    fallbackGuest: { login: 'A1 Padel', password: 'ciDERedrU3wlfrekacHo' },
  },
  simonas: { platform: 'own', scrape: scrapeSimonas },
  kpadel: { platform: 'moove', locationId: 227 },
  prienuose: { platform: 'own', scrape: scrapePrienuose },
  zirmunai: { platform: 'winero', arenaId: 'a77b94b4-46c0-4e7b-b69d-2ed700d3e483' },
  padelfactory: { platform: 'winero', arenaId: '6526ba41-0328-4562-9da0-c8708f2e42ec', skipCourts: ['kamuoliukų mašina', 'ball machine'] },
  vilmers: { platform: 'winero', arenaId: 'c389edb7-7e41-4e2e-bcb2-a6157cdcfc97' },
  minija: { platform: 'winero', arenaId: 'fdaf2d26-fee7-482d-a555-75140ba59999' },
  gopadel: { platform: 'own', scrape: scrapeGoPadel },
  padelin: { platform: 'own', scrape: scrapePadelin },
  bsportklaipeda: { platform: 'ntennis', baseUrl: 'https://savitarna.bsport.lt', placeId: 2 },
  skycop: { platform: 'ntennis', baseUrl: 'https://savitarna.padelionamai.lt', placeId: 4 },
  padelionamai: { platform: 'ntennis', baseUrl: 'https://savitarna.padelionamai.lt', placeId: 2 },
  drevernos: { platform: 'moove', locationId: 288, indoor: true },
  startpadel: { platform: 'moove', locationId: 158, indoor: true },
  '4padel': { platform: 'playball', slug: '4padel-arena' },
  padelspot: { platform: 'playball', slug: 'padel-spot-arena' },
  oshee: { platform: 'playball', slug: 'oshee-teniso-ir-padelio-arena' },
  mostai: { platform: 'moove', locationId: 224, indoor: true },
  fanumetalo: { platform: 'moove', locationId: 2, indoor: true },
  fanuplunges: { platform: 'moove', locationId: 88, indoor: true },
  palahouse: { platform: 'ntennis', baseUrl: 'https://savitarna.padeltennis.lt', placeId: 9 },
  playdate: { platform: 'ntennis', baseUrl: 'https://savitarna.padeltennis.lt', placeId: 1 },
  bsportvilnius: { platform: 'ntennis', baseUrl: 'https://savitarna.baltictennis.lt', placeId: 2 },
  rato: { platform: 'ntennis', baseUrl: 'https://savitarna.ratopadelioarena.lt', placeId: 1 },
  skypadel: { platform: 'moove', locationId: 145, indoor: false },
  upadel: { platform: 'moove', locationId: 297, indoor: true },
  delfi: { platform: 'ntennis', baseUrl: 'https://rezervacija.delfisportocentras.lt', placeId: 6 },
}

/** The scraper a spec describes */
export function scraperFor(spec: ScraperSpec): Scraper {
  switch (spec.platform) {
    case 'moove': return mooveScraper(spec)
    case 'ntennis': return ntennisScraper(spec)
    case 'winero': return wineroScraper(spec)
    case 'playball': return playballScraper(spec)
    case 'own': return spec.scrape
  }
}

/** Built once: platform scrapers are stateless closures over their spec */
const SCRAPER_FNS = Object.fromEntries(Object.entries(SCRAPERS).map(([id, spec]) => [id, scraperFor(spec)])) as Record<VenueId, Scraper>

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
  return Promise.all(VENUES.map(info => runScraper(info, SCRAPER_FNS[info.id], date)))
}
