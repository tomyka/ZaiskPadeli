import type { Venue, TimeSlot } from './types'
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
const BOOKING_URL = 'https://simonastennis.lt/rezervacija'

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

/** Generate all 30-min slot start times (HH:MM) within working hours */
function generateAllSlots(fromIso: string, toIso: string): string[] {
  return halfHourSlots(toHHMM(fromIso), toHHMM(toIso))
}

export async function scrapeSimonas(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'simonas',
    name: 'Simonas Tennis Club',
    address: 'Verslo I g. 7, Liūdynė, Panevėžys',
    city: 'Panevėžys',
    bookingUrl: BOOKING_URL,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // API expects month/day without leading zeros
    const [year, month, day] = date.split('-').map(Number)

    const resp = await fetch(
      `${API_BASE}/courts/v2/availabilities?type=PADEL&year=${year}&month=${month}&day=${day}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) }
    )
    if (!resp.ok) {
      venue.error = `API returned ${resp.status}`
      return venue
    }

    const data: { availabilities: SimonasAvailability[] } = await resp.json()
    const currentMinutes = currentMinutesFor(date)

    for (const item of data.availabilities ?? []) {
      const { court, slots: availableSlots } = item

      // Build a Set of available start times for fast lookup
      const availableSet = new Set(availableSlots.map(s => toHHMM(s.fromTime)))
      // Build a price map: HH:MM → price
      const priceMap = new Map(availableSlots.map(s => [toHHMM(s.fromTime), s.price]))

      // Generate all slots within working hours
      const allSlotTimes = generateAllSlots(
        court.workingHours.fromTime,
        court.workingHours.toTime
      )

      const timeSlots: TimeSlot[] = allSlotTimes.map(time => {
        const isAvailable = !isSlotOver(time, currentMinutes) && availableSet.has(time)
        return {
          time,
          available: isAvailable,
          price: isAvailable ? (priceMap.get(time) ?? null) : null,
        }
      })

      venue.courts.push({
        id: `simonas-${court.id}`,
        name: `Kortas ${court.name}`,
        type: 'doubles',
        indoor: true,
        slots: timeSlots,
      })
    }

    if (venue.courts.length === 0) {
      venue.error = 'Nėra duomenų'
    }
  } catch (err) {
    console.warn('[simonas] scrape failed:', (err as Error).message)
    venue.error = 'Nepavyko gauti Simonas Tennis Club duomenų'
  }

  return venue
}
