// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import { COUNTIES, MUNICIPALITIES, countyOf, type County, type Municipality } from '../../server/utils/regions'
import type { CourtKind } from '../../server/utils/types'
import { toLocation } from './location'

/**
 * The visitor's remembered choices. Stored in a cookie the visitor controls,
 * so everything read back goes through `parsePrefs`.
 */

export const DURATIONS = [60, 90, 120] as const
export type Duration = typeof DURATIONS[number]

export interface Prefs {
  /** null = all counties */
  county: County | null
  /** null = the whole county; otherwise always a municipality in `county` */
  municipality: Municipality | null
  duration: Duration
  /** null = any court type */
  type: CourtKind | null
  /** null = indoor and outdoor */
  indoor: boolean | null
}

export const DEFAULT_PREFS: Readonly<Prefs> = { county: 'Kauno', municipality: null, duration: 90, type: null, indoor: null }

/** Any stored value → valid Prefs; each unexpected field falls back to its default. */
export function parsePrefs(raw: unknown): Prefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const m = p.municipality as Municipality
  return {
    ...toLocation(parseCounty(p), MUNICIPALITIES.includes(m) ? m : null),
    duration: DURATIONS.includes(p.duration as Duration) ? (p.duration as Duration) : DEFAULT_PREFS.duration,
    type: p.type === 'doubles' || p.type === 'singles' ? p.type : null,
    indoor: typeof p.indoor === 'boolean' ? p.indoor : null,
  }
}

function parseCounty(p: Record<string, unknown>): County | null {
  if ('county' in p) {
    if (p.county === null) return null
    return COUNTIES.includes(p.county as County) ? (p.county as County) : DEFAULT_PREFS.county
  }
  // Cookie from before counties (Nov 2026): { city: 'Kaunas' } → that city's county, null → everywhere.
  // Safe to drop once those cookies have expired (1-year max age).
  if ('city' in p) {
    if (p.city === null) return null
    return MUNICIPALITIES.includes(p.city as Municipality) ? countyOf(p.city as Municipality) : DEFAULT_PREFS.county
  }
  return DEFAULT_PREFS.county
}
