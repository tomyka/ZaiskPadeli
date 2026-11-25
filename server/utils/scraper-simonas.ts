import type { Court, TimeSlot } from './types'
import { currentMinutesFor, halfHourSlots, isSlotOver } from './time'

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

interface SimonasCourt {
  id: number
  name: string        // "1", "2"
  type: string        // "Padel"
  workingHours: {
    fromTime: string
    toTime: string
    intervalLengthMinutes: number
  }
}

interface SimonasAvailability {
  court: SimonasCourt
  slots: SimonasSlot[]
}

/**
 * Extract "HH:MM" from an ISO datetime string.
 * The Simonas API returns times in Lithuanian local time with offset (+03:00 summer / +02:00 winter),
 * so we read the time component directly from the string rather than converting to UTC.
 */
function toHHMM(iso: string): string {
  return iso.slice(11, 16)
}

export async function scrapeSimonas(date: string, venue: { id: string }): Promise<Court[]> {
  // API expects month/day without leading zeros
  const [year, month, day] = date.split('-').map(Number)
  const resp = await fetch(
    `${API_BASE}/courts/v2/availabilities?type=PADEL&year=${year}&month=${month}&day=${day}`,
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) },
  )
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)

  const data: { availabilities: SimonasAvailability[] } = await resp.json()
  const currentMinutes = currentMinutesFor(date)

  // The API lists only AVAILABLE slots; everything else within working hours is booked
  return (data.availabilities ?? []).map(({ court, slots: availableSlots }) => {
    const priceByTime = new Map(availableSlots.map(s => [toHHMM(s.fromTime), s.price]))
    const slots: TimeSlot[] = halfHourSlots(toHHMM(court.workingHours.fromTime), toHHMM(court.workingHours.toTime))
      .map(time => {
        const available = !isSlotOver(time, currentMinutes) && priceByTime.has(time)
        return { time, available, price: available ? (priceByTime.get(time) ?? null) : null }
      })
    return { id: `${venue.id}-${court.id}`, name: `Kortas ${court.name}`, type: 'doubles' as const, slots }
  })
}
