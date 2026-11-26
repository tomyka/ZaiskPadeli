import type { Court } from './types'
import { toSlots } from './day-grid'
import { currentMinutesFor, fromMinutes } from './time'

/**
 * Padel Hub — Mokesta API (ABP Framework)
 * Clean REST API, no auth required.
 * GET /api/services/app/Padelhub/GetCourtReservations?date=YYYY-MM-DD
 */
export async function scrapePadelHub(date: string, venue: { id: string }): Promise<Court[]> {
  const url = `https://padelhubsavapi.mokesta.lt/api/services/app/Padelhub/GetCourtReservations?date=${date}`
  const data = await $fetch<{ result?: PadelHubCourt[] }>(url, { timeout: 15000 })
  if (!data?.result) throw new Error('No data returned from API')
  return parsePadelHubCourts(data.result, venue.id, currentMinutesFor(date))
}

/** One court as returned by GetCourtReservations (fields we use only). */
export interface PadelHubCourt {
  id: number
  name: string | null
  /** Court category, e.g. "Padelis" or "Skvosas" */
  tab: string | null
  times: PadelHubTime[]
}

export interface PadelHubTime {
  timeIdentifier: number
  isReserved: boolean
  price: number | null
}

/**
 * timeIdentifier is a 1-based half-hour index from midnight: 1 = 00:00, 2 = 00:30, 14 = 06:30.
 * Mirrors the booking site's own `timeDisplay`: hour = floor((id - 1) / 2).
 */
export function padelHubSlotTime(timeIdentifier: number): string {
  return fromMinutes((timeIdentifier - 1) * 30)
}

export function parsePadelHubCourts(result: PadelHubCourt[], idPrefix: string, currentMinutes = -1): Court[] {
  const courts: Court[] = []
  for (const court of result) {
    // Only include padel courts (skip squash)
    if (!court.tab?.toLowerCase().includes('padel')) continue

    const name = (court.name || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const isDoubles = name.toLowerCase().includes('dvejet')
    const isSingles = name.toLowerCase().includes('vienet')

    const slots = toSlots(court.times.map(t => ({
      time: padelHubSlotTime(t.timeIdentifier),
      free: !t.isReserved,
      price: t.price ?? null,
    })), currentMinutes)

    courts.push({
      id: `${idPrefix}-${court.id}`,
      name: name
        .replace(/Padelio (?:dvejetų|vienetų) kortas\s*/i, '')
        .replace(/\s*[„“”",]+\s*/g, ' ')
        .replace(/^\d+\s*/, (m: string) => `#${m.trim()} `)
        .trim() || `Kortas ${court.id}`,
      type: isSingles ? 'singles' : isDoubles ? 'doubles' : 'unknown',
      slots,
    })
  }
  return courts
}
