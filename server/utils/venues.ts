import { countyOf, type County, type Municipality } from './regions'

/**
 * Single source of truth for every venue shown in the app.
 *
 * Pure data — no scraper imports — so the client can import it too
 * (colours, active regions). Scrapers are bound to these ids in scraper-all.ts,
 * where the type system enforces that every venue here has a scraper.
 *
 * Order here is the order venues are listed in the UI.
 *
 * Adding a venue:
 *   1. add an entry below
 *   2. add its scraper to SCRAPERS in scraper-all.ts (typecheck fails until you do)
 */

export interface VenueInfo {
  id: string
  name: string
  address: string
  /** The municipality the venue is actually in, e.g. 'Prienų r.' for a venue outside Prienai */
  municipality: Municipality
  bookingUrl: string
  /** Default for courts whose scraper doesn't say; per-court values win */
  indoor?: boolean
  /** Accent colour (card border + active filter pill) */
  color: string
}

export const VENUES = [
  // ── Kaunas ──────────────────────────────────────────────────────────────────
  {
    id: 'padelhub',
    name: 'Balcia Padel Hub',
    address: 'B. Brazdžionio g. 25, Kaunas',
    municipality: 'Kaunas',
    bookingUrl: 'https://savpadelhub.mokesta.lt/',
    indoor: true,
    color: '#3b82f6',
  },
  {
    id: 'padelhouse',
    name: 'Padel House',
    address: 'A. Juozapavičiaus pr. 3, Kaunas',
    municipality: 'Kaunas',
    bookingUrl: 'https://rezervacija.padelhouse.lt/',
    indoor: true,
    color: '#f97316',
  },
  {
    id: 'tennisspace',
    name: 'Tennis Space',
    address: 'Islandijos pl. 9C, Kaunas',
    municipality: 'Kaunas',
    bookingUrl: 'https://savitarna.tennisspace.lt/reservation/short?iPlaceId=4',
    indoor: true,
    color: '#22c55e',
  },
  {
    id: 'kaunopadelis',
    name: 'Kauno Padelio Klubas',
    address: 'Lyderystės g. 6, Kaunas',
    municipality: 'Kaunas',
    bookingUrl: 'https://savitarna.kaunopadelis.lt/reservation/short',
    indoor: true,
    color: '#eab308',
  },
  {
    id: 'padel4u',
    name: 'Padel4U',
    address: 'Lakūnų pl., Kaunas',
    municipality: 'Kaunas',
    bookingUrl: 'https://padel4u.cloud/',
    // indoor/outdoor not stated by the club — left unknown (shown under both filters)
    color: '#d946ef',
  },
  // ── Vilnius ─────────────────────────────────────────────────────────────────
  {
    id: 'vilniuspadel',
    name: 'Vilnius Padel Arena',
    address: 'Žygio g. 97A, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://rezervacijos.vilniuspadel.lt/reservation/short',
    indoor: true,
    color: '#8b5cf6',
  },
  // ── Klaipėda ────────────────────────────────────────────────────────────────
  {
    id: 'a1padel',
    name: 'A1Padel Klaipėda',
    address: 'Smilgų g. 5, Klaipėda',
    municipality: 'Klaipėda',
    bookingUrl: 'https://savitarna.a1padel.lt/reservation/short',
    indoor: true,
    color: '#06b6d4',
  },
  // ── Panevėžys ───────────────────────────────────────────────────────────────
  {
    id: 'simonas',
    name: 'Simonas Tennis Club',
    address: 'Verslo I g. 7, Liūdynė, Panevėžio r.',
    municipality: 'Panevėžio r.',
    bookingUrl: 'https://simonastennis.lt/rezervacija',
    indoor: true,
    color: '#ec4899',
  },
  {
    id: 'kpadel',
    name: 'K-Padel',
    address: 'Ramygalos g. 149E, Panevėžys',
    municipality: 'Panevėžys',
    bookingUrl: 'https://app.moove.lt/padel/reservation',
    // indoor decided per court ("laukas" = outdoor)
    color: '#6366f1',
  },
  // ── Prienų r. (Kauno apskritis) ─────────────────────────────────────────
  {
    id: 'prienuose',
    name: 'Padelis Prienuose',
    address: 'Ropių g. 44, Prienai',
    municipality: 'Prienų r.',
    bookingUrl: 'https://padelisprienuose.lt/booking',
    indoor: false,
    color: '#f59e0b',
  },
  // ── Winero.lt venues ───────────────────────────────────────────────────────
  {
    id: 'zirmunai',
    name: 'Žirmūnų Padelio Arena',
    address: 'Žirmūnų g. 139, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/irmn-padelio-arena',
    indoor: true,
    color: '#14b8a6',
  },
  {
    id: 'padelfactory',
    name: 'Padel Factory',
    address: 'Savanorių pr. 180, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/padel-factory',
    indoor: true,
    color: '#f43f5e',
  },
  // BAJADA (Panevėžys), Aukštaitijos Padelio Klubas (Panevėžys) and Harmony Park (Prienų r.)
  // were removed (#41): Winero only lists them (reservation: false), so its availability
  // showed every slot free, and none publishes availability anywhere else.
  // ── Šiauliai ────────────────────────────────────────────────────────────────
  {
    id: 'vilmers',
    name: 'Vilmers padel namai',
    address: 'Latvių g. 60A, Šiauliai',
    municipality: 'Šiauliai',
    bookingUrl: 'https://www.winero.lt/arena/vilmers-padel-namai',
    indoor: true, // "14 padelio uždarų kortų"
    color: '#be123c',
  },
  // ── Telšių apskritis ────────────────────────────────────────────────────────
  {
    id: 'minija',
    name: 'Minija Resort',
    address: 'Lekemės k., Plungės r.',
    municipality: 'Plungės r.',
    bookingUrl: 'https://www.winero.lt/arena/minija-resort',
    indoor: false, // one lit outdoor court
    color: '#0f766e',
  },
  // ── Alytaus apskritis ───────────────────────────────────────────────────────
  {
    id: 'gopadel',
    name: 'GO Padel',
    address: 'Kovo 11-osios g. 2, Alytus',
    municipality: 'Alytus',
    bookingUrl: 'https://gopadel.lt/rezervuoti?facility=padel',
    indoor: true, // 9 heated indoor courts
    color: '#a855f7',
  },
  // ── Marijampolės apskritis ──────────────────────────────────────────────────
  {
    id: 'padelin',
    name: 'Padel in',
    address: 'Prienų g. 19, Patašinės k., Marijampolės sav.',
    municipality: 'Marijampolė',
    bookingUrl: 'https://padelin.lt/pages/reservation',
    // indoor/outdoor not stated by the club: left unknown (shown under both filters)
    color: '#0ea5e9',
  },
] as const satisfies readonly VenueInfo[]

export type VenueId = (typeof VENUES)[number]['id']

const BY_ID = new Map<string, VenueInfo>(VENUES.map(v => [v.id, v]))

export function venueInfo(id: string): VenueInfo | undefined {
  return BY_ID.get(id)
}

/** Municipalities that have at least one venue */
export const ACTIVE_MUNICIPALITIES: ReadonlySet<Municipality> = new Set(VENUES.map(v => v.municipality))

/** Counties that have at least one venue — the rest are shown as "coming soon" */
export const ACTIVE_COUNTIES: ReadonlySet<County> = new Set(VENUES.map(v => countyOf(v.municipality)))
