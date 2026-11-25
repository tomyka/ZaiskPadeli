export interface TimeSlot {
  time: string        // "07:00", "07:30", etc.
  available: boolean
  price: number | null
}

export interface Court {
  id: string          // unique: "padelhub-1", "tennisspace-46", "padelhouse-1"
  name: string        // "Kortas 1", "01 Neodenta"
  type: 'doubles' | 'singles' | 'unknown'
  indoor?: boolean    // true = indoor, false = outdoor, undefined = unknown
  /** In venue-day order (after-midnight slots last); runScraper guarantees it */
  slots: TimeSlot[]
}

export type City = 'Vilnius' | 'Kaunas' | 'Klaipėda' | 'Šiauliai' | 'Panevėžys'

export const CITIES: City[] = ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys']

export const CITY_COORDS: Record<City, { lat: number; lng: number }> = {
  'Vilnius':    { lat: 54.6872, lng: 25.2797 },
  'Kaunas':     { lat: 54.8985, lng: 23.9036 },
  'Klaipėda':   { lat: 55.7033, lng: 21.1443 },
  'Šiauliai':   { lat: 55.9349, lng: 23.3137 },
  'Panevėžys':  { lat: 55.7348, lng: 24.3601 },
}

export interface Venue {
  id: string          // "padelhub", "tennisspace", "padelhouse", "kaunopadelis"
  name: string        // "Balcia Padel Hub"
  address: string
  city: City
  bookingUrl: string
  courts: Court[]
  lastUpdated: string // ISO timestamp
  error?: string
  /** This scrape failed; courts are the last good data from `lastUpdated` (see carryOverFailedVenues) */
  carriedOver?: true
}

/** Per-date health report from /api/cron/scrape, read by the cf-proxy Worker's cron */
export interface ScrapeReport {
  venues: number
  /** Venues showing an error (failed or empty day) */
  errors: number
  failed: string[]
  /** Scrape failed but last good data is still shown */
  carried: string[]
  ms: number
}

export interface AvailabilityResponse {
  date: string        // "2026-04-21"
  venues: Venue[]
  fetchedAt: string   // ISO timestamp
  fromCache: boolean
  cacheAgeSeconds: number | null
}

/** A court's type for display and filtering; 'unknown' counts as doubles (see courtKind in app/utils/availability.ts) */
export type CourtKind = Exclude<Court['type'], 'unknown'>
