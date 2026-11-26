import type { Court } from './types'
import { openingSlots, toSlots } from './day-grid'
import { currentMinutesFor } from './time'

/**
 * Simonas Tennis Club — custom API
 *
 * Endpoint: GET https://stc-be-prod-04da9087a4d3.herokuapp.com/api/courts/v2/availabilities
 * Query params: type=PADEL&year=YYYY&month=M&day=D
 *
 * The API returns ONLY available slots (booked slots are omitted).
 * Working hours come from court.workingHours.fromTime/toTime.
 */

const API_BASE = 'https://stc-be-prod-04da9087a4d3.herokuapp.com/api'

interface SimonasSlot {
  fromTime: string   // ISO datetime "2026-05-28T07:00:00+03:00"
  toTime: string
  price: number
}

export interface SimonasAvailability {
  court: {
    id: number
    name: string        // "1", "2"
    workingHours: { fromTime: string; toTime: string }
  }
  slots: SimonasSlot[]
}

/**
 * "HH:MM" from an ISO datetime string. The API gives Lithuanian local time with its
 * offset (+03:00 summer / +02:00 winter), so the clock part is read as is, not converted.
 */
function toHHMM(iso: string): string {
  return iso.slice(11, 16)
}

/** Pure: the API's availabilities → Court[]; any working-hours slot not listed is booked */
export function buildSimonasCourts(availabilities: SimonasAvailability[], idPrefix: string, currentMinutes = -1): Court[] {
  return availabilities.map(({ court, slots: freeSlots }) => {
    const priceByTime = new Map(freeSlots.map(s => [toHHMM(s.fromTime), s.price]))
    const times = openingSlots(toHHMM(court.workingHours.fromTime), toHHMM(court.workingHours.toTime))
    return {
      id: `${idPrefix}-${court.id}`,
      name: `Kortas ${court.name}`,
      type: 'doubles' as const,
      slots: toSlots(times.map(time => ({ time, free: priceByTime.has(time), price: priceByTime.get(time) ?? null })), currentMinutes),
    }
  })
}

export async function scrapeSimonas(date: string, venue: { id: string }): Promise<Court[]> {
  // API expects month/day without leading zeros
  const [year, month, day] = date.split('-').map(Number)
  const resp = await fetch(
    `${API_BASE}/courts/v2/availabilities?type=PADEL&year=${year}&month=${month}&day=${day}`,
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  )
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  const data = (await resp.json()) as { availabilities?: SimonasAvailability[] }
  return buildSimonasCourts(data.availabilities ?? [], venue.id, currentMinutesFor(date))
}
