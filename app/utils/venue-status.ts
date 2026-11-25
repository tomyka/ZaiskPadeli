// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import { hasNoCourtData, type Venue } from '../../server/utils/types'
import { formatClock } from './format'

/** What a venue's status means to the visitor. The server only sends the status. */

const PROBLEM_TEXT = {
  empty: 'Nėra duomenų šiai dienai',
  failed: 'Nepavyko gauti duomenų',
} as const

/** Why a venue shows no times, or null when it has courts to show (current or older) */
export function venueProblem(v: Pick<Venue, 'status'>): string | null {
  return hasNoCourtData(v.status) ? PROBLEM_TEXT[v.status] : null
}

/** "duomenys 14:05" for a venue showing older data after a failed scrape, else null */
export function staleNote(v: Pick<Venue, 'status' | 'lastUpdated'>): string | null {
  return v.status === 'stale' ? `duomenys ${formatClock(v.lastUpdated)}` : null
}
