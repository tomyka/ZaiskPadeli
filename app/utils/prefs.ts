// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import { CITIES, type City } from '../../server/utils/types'
import type { CourtKind } from './availability'

/**
 * The visitor's remembered choices. Stored in a cookie the visitor controls,
 * so everything read back goes through `parsePrefs`.
 */

export const DURATIONS = [60, 90, 120] as const
export type Duration = typeof DURATIONS[number]

export interface Prefs {
  /** null = all cities */
  city: City | null
  duration: Duration
  /** null = any court type */
  type: CourtKind | null
  /** null = indoor and outdoor */
  indoor: boolean | null
}

export const DEFAULT_PREFS: Readonly<Prefs> = { city: 'Kaunas', duration: 90, type: null, indoor: null }

/** Any stored value → valid Prefs; each unexpected field falls back to its default. */
export function parsePrefs(raw: unknown): Prefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    city: p.city === null ? null : CITIES.includes(p.city as City) ? (p.city as City) : DEFAULT_PREFS.city,
    duration: DURATIONS.includes(p.duration as Duration) ? (p.duration as Duration) : DEFAULT_PREFS.duration,
    type: p.type === 'doubles' || p.type === 'singles' ? p.type : null,
    indoor: typeof p.indoor === 'boolean' ? p.indoor : null,
  }
}
