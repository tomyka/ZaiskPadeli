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

export interface Venue {
  id: string          // "padelhub", "tennisspace", "padelhouse", "kaunopadelis"
  name: string        // "Balcia Padel Hub"
  address: string
  /** Where the venue actually is; its county follows (regions.ts) */
  municipality: Municipality
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
