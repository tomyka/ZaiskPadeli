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
    address: 'Smilgų g. 5, Dirvupių k., Klaipėdos r.',
    municipality: 'Klaipėdos r.',
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
  // ── Klaipėdos apskritis (added in #33) ──────────────────────────────────────
  {
    id: 'bsportklaipeda',
    name: 'Bsport arena',
    address: 'Tilžės g. 90, Klaipėda',
    municipality: 'Klaipėda',
    bookingUrl: 'https://savitarna.bsport.lt/',
    indoor: true,
    color: '#ef4444',
  },
  {
    id: 'skycop',
    name: 'Skycop padelio arena',
    address: 'Bangų g. 2, Klaipėda',
    municipality: 'Klaipėda',
    bookingUrl: 'https://savitarna.padelionamai.lt/',
    // 5 courts, 4 of them covered; the grid doesn't say which: left unknown
    color: '#84cc16',
  },
  {
    id: 'padelionamai',
    name: 'Padelio namai',
    address: 'Jungtinė g. 1, Aukštkiemiai, Klaipėdos r.',
    municipality: 'Klaipėdos r.',
    bookingUrl: 'https://savitarna.padelionamai.lt/',
    indoor: true, // "Slėnis viduje"
    color: '#0284c7',
  },
  {
    id: 'drevernos',
    name: 'Drevernos uostas',
    address: 'Pamario g. 12, Drevernos k., Klaipėdos r.',
    municipality: 'Klaipėdos r.',
    bookingUrl: 'https://app.moove.lt/padel/club/reservation/136?locationId=288',
    indoor: true, // the indoor courts; the outdoor ones are seasonal (#42)
    color: '#c2410c',
  },
  {
    id: 'startpadel',
    name: 'Start Padel Palanga',
    address: 'Vėjų g. 6, Palanga',
    municipality: 'Palanga',
    bookingUrl: 'https://app.moove.lt/padel/reservation',
    indoor: true,
    color: '#7c3aed',
  },
  {
    id: '4padel',
    name: '4Padel Arena',
    address: 'Tilžės g. 86, Klaipėda',
    municipality: 'Klaipėda',
    bookingUrl: 'https://www.playball.lt/lt/arenas/4padel-arena/book',
    indoor: true,
    color: '#2563eb',
  },
  {
    id: 'padelspot',
    name: 'Padel Spot',
    address: 'Verslo g. 8, Klaipėda',
    municipality: 'Klaipėda',
    bookingUrl: 'https://www.playball.lt/lt/arenas/padel-spot-arena/book',
    indoor: true,
    color: '#db2777',
  },
  {
    id: 'oshee',
    name: 'OSHEE padelio arena',
    address: 'Palangos pl. 13, Vydmantai, Kretingos r.',
    municipality: 'Kretingos r.',
    bookingUrl: 'https://playball.lt/lt/arenas/oshee-teniso-ir-padelio-arena/book',
    indoor: true,
    color: '#16a34a',
  },
  // ── Vilniaus apskritis (added in #31) ───────────────────────────────────────
  {
    id: 'mostai',
    name: 'Mostai padelio klubas',
    address: 'Savanorių pr. 178B, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://app.moove.lt/padel/club/reservation/1?locationId=224',
    indoor: true,
    color: '#0891b2',
  },
  {
    id: 'fanumetalo',
    name: 'Padelio arena, Metalo g.',
    address: 'Metalo g. 2, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://app.moove.lt/padel/club/reservation/1?locationId=2',
    indoor: true,
    color: '#e11d48',
  },
  {
    id: 'fanuplunges',
    name: 'Padelio arena, Plungės g.',
    address: 'Plungės g. 4, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://app.moove.lt/padel/club/reservation/1?locationId=88',
    indoor: true,
    color: '#9333ea',
  },
  {
    id: 'palahouse',
    name: 'Pala House',
    address: 'Vakarinė g. 10, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://savitarna.padeltennis.lt/reservation/short?iPlaceId=9',
    indoor: true,
    color: '#ca8a04',
  },
  {
    id: 'playdate',
    name: 'PlayDate arena',
    address: 'Viršuliškių skg. 28, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://savitarna.padeltennis.lt/reservation/short?iPlaceId=1',
    indoor: true,
    color: '#059669',
  },
  {
    id: 'bsportvilnius',
    name: 'Bsport arena, Telšių g.',
    address: 'Telšių g. 17, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://savitarna.baltictennis.lt/reservation/short',
    indoor: true,
    color: '#dc2626',
  },
  {
    id: 'rato',
    name: 'Rato padelio arena',
    address: 'J. Kubiliaus g. 21, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://savitarna.ratopadelioarena.lt/',
    indoor: true,
    color: '#4f46e5',
  },
  {
    id: 'skypadel',
    name: 'Sky Padel, Vilnius Outlet',
    address: 'Vytauto Pociūno g. 8, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://app.moove.lt/padel/club/reservation/105?locationId=145',
    indoor: false,
    color: '#0d9488',
  },
  {
    id: 'upadel',
    name: 'UPadel',
    address: 'V. Bergo g. 8, Rečionys, Ukmergės r.',
    municipality: 'Ukmergės r.',
    bookingUrl: 'https://moove.lt/padel/club/reservation/138',
    indoor: true,
    color: '#b45309',
  },
  {
    id: 'delfi',
    name: 'DELFI sporto centras',
    address: 'Ozo g. 14C, Vilnius',
    municipality: 'Vilnius',
    bookingUrl: 'https://rezervacija.delfisportocentras.lt/',
    indoor: true,
    color: '#f97316',
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
