import type { Municipality } from './regions'

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

/**
 * - ok:     scraped; `courts` are current
 * - empty:  scraped fine, but the venue has no courts that day
 * - failed: the scrape failed and there is no recent data
 * - stale:  the scrape failed; `courts` are the last good data, from `lastUpdated`
 */
export type VenueStatus = 'ok' | 'empty' | 'failed' | 'stale'

/** No courts to show: the scrape failed with nothing to fall back on, or the venue has no courts that day */
export function hasNoCourtData(status: VenueStatus): status is 'empty' | 'failed' {
  return status === 'empty' || status === 'failed'
}

export interface Venue {
  id: string          // "padelhub", "tennisspace", "padelhouse", "kaunopadelis"
  name: string        // "Balcia Padel Hub"
  address: string
  /** Where the venue actually is; its county follows (regions.ts) */
  municipality: Municipality
  bookingUrl: string
  courts: Court[]
  /** When `courts` were scraped (ISO) */
  lastUpdated: string
  status: VenueStatus
}

/** Per-date health report from /api/cron/scrape, read by the cf-proxy Worker's cron */
export interface ScrapeReport {
  venues: number
  /** Venues with no bookable data: status failed or empty */
  errors: number
  failed: string[]
  /** Scrape failed but last good data is still shown: status stale */
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
