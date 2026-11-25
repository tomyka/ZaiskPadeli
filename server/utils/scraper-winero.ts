import type { City, Venue, TimeSlot } from './types'
import { currentMinutesFor, dayOfWeek, halfHourSlots, isSlotOver, toEndMinutes, toMinutes } from './time'

/**
 * Generic Winero.lt scraper
 * Public API: /api/arenas/{id} + /api/bookings/public-availability?arena_id={id}&date={date}
 * Returns booked slots; we invert against operating hours to get availability.
 */

const WINERO_BASE = 'https://www.winero.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

interface WineroTimeSlot { start_time: string; end_time: string; price: number }
interface WineroPricePeriod { days: string[]; time_slots?: WineroTimeSlot[] }
interface WineroExceptionPeriod extends WineroPricePeriod { start_date: string; end_date: string }
export interface WineroCourt {
  id: string
  name: string
  price_periods?: WineroPricePeriod[]
  exception_price_periods?: WineroExceptionPeriod[]
}

/** Parse "Monday 06:00 – 23:00\nTuesday..." → {open: "06:00", close: "23:00"} for the given date */
export function parseOpeningHours(raw: string, date: string): { open: string; close: string } | null {
  const dayName = DAY_NAMES[dayOfWeek(date)]!
  // Winero returns either real newlines or literal "\n" escape sequences
  for (const line of raw.split(/\\n|\n/)) {
    if (!line.includes(dayName)) continue
    const match = line.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
    if (match?.[1] && match[2]) return { open: match[1].padStart(5, '0'), close: match[2].padStart(5, '0') }
  }
  return null
}

function priceIn(slots: WineroTimeSlot[] | undefined, slotMin: number): number | null {
  for (const ts of slots ?? []) {
    if (slotMin >= toMinutes(ts.start_time) && slotMin < toEndMinutes(ts.end_time)) return ts.price / 2 // per hour → per 30 min
  }
  return null
}

/** Per-30-min price for a slot. Exception periods (date-ranged) take precedence over regular ones. */
export function getPriceForSlot(court: WineroCourt, date: string, slotTime: string): number | null {
  const slotMin = toMinutes(slotTime)
  const day = DAY_NAMES[dayOfWeek(date)]!.toLowerCase()

  for (const exc of court.exception_price_periods ?? []) {
    // ISO dates compare correctly as strings
    if (exc.days.includes(day) && date >= exc.start_date && date <= exc.end_date) {
      const price = priceIn(exc.time_slots, slotMin)
      if (price !== null) return price
    }
  }
  for (const period of court.price_periods ?? []) {
    if (!period.days.includes(day)) continue
    const price = priceIn(period.time_slots, slotMin)
    if (price !== null) return price
  }
  return null
}

export interface WineroArenaConfig {
  id: string
  venueId: string
  name: string
  address: string
  /** Defaults to Vilnius */
  city?: City
  bookingUrl: string
  /** Whether courts are indoors (true) or outdoors (false). Omit for unknown. */
  indoor?: boolean
  /** Court name substrings to skip (case-insensitive) */
  skipCourts?: string[]
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

export async function scrapeWineroArena(config: WineroArenaConfig, date: string): Promise<Venue> {
  const venue: Venue = {
    id: config.venueId,
    name: config.name,
    address: config.address,
    city: config.city ?? 'Vilnius',
    bookingUrl: config.bookingUrl,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const [arenaData, availData] = await Promise.all([
      getJson(`${WINERO_BASE}/api/arenas/${config.id}`),
      getJson(`${WINERO_BASE}/api/bookings/public-availability?arena_id=${config.id}&date=${date}`),
    ])

    if (!arenaData?.id) {
      venue.error = 'Arena not found'
      return venue
    }

    // Booked ranges per court
    const bookedMap = new Map<string, Array<{ start: number; end: number }>>()
    for (const slot of availData?.data ?? []) {
      const ranges = bookedMap.get(slot.court_id) ?? []
      ranges.push({ start: toMinutes(slot.start_time), end: toEndMinutes(slot.end_time) })
      bookedMap.set(slot.court_id, ranges)
    }

    const hours = parseOpeningHours(arenaData.opening_hours ?? '', date)
    if (!hours) {
      venue.error = 'Could not parse opening hours'
      return venue
    }

    const slotTimes = halfHourSlots(hours.open, hours.close)
    const currentMinutes = currentMinutesFor(date)
    const courts: WineroCourt[] = arenaData.courts ?? []

    for (const court of courts) {
      const name = court.name.toLowerCase()
      if (config.skipCourts?.some(s => name.includes(s.toLowerCase()))) continue

      const booked = bookedMap.get(court.id) ?? []
      const slots: TimeSlot[] = slotTimes.map(time => {
        const slotStart = toMinutes(time)
        const slotEnd = slotStart + 30
        const isBooked = booked.some(b => b.start < slotEnd && b.end > slotStart)
        const available = !isSlotOver(time, currentMinutes) && !isBooked
        return { time, available, price: available ? getPriceForSlot(court, date, time) : null }
      })

      venue.courts.push({
        id: `${config.venueId}-${court.id}`,
        name: court.name,
        type: name.includes('single') ? 'singles' : 'doubles',
        indoor: config.indoor,
        slots,
      })
    }
  } catch (err) {
    console.warn(`[${config.venueId}] scrape failed:`, (err as Error).message)
    venue.error = `Failed to fetch ${config.name} data`
  }

  return venue
}

// ─── Venue configurations ─────────────────────────────────────────────────────

export const WINERO_VENUES: WineroArenaConfig[] = [
  {
    id: 'a77b94b4-46c0-4e7b-b69d-2ed700d3e483',
    venueId: 'zirmunai',
    name: 'Žirmūnų Padelio Arena',
    address: 'Žirmūnų g. 139, Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/irmn-padelio-arena',
    indoor: true,
  },
  {
    id: '6526ba41-0328-4562-9da0-c8708f2e42ec',
    venueId: 'padelfactory',
    name: 'Padel Factory',
    address: 'Savanorių pr. 180, Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/padel-factory',
    indoor: true,
    skipCourts: ['kamuoliukų mašina', 'ball machine'],
  },
  // ── Panevėžys ────────────────────────────────────────────────────────────────
  {
    id: '887c031b-06a6-4799-8355-fb2685f2b508',
    venueId: 'bajada',
    name: 'BAJADA Padelio Kortai',
    address: 'Elektronikos g. 64, Panevėžys',
    city: 'Panevėžys',
    bookingUrl: 'https://www.panevezyspadel.lt',
    indoor: true,
  },
  {
    id: 'a582ca8a-ef5a-45ba-b50e-915d1b2b71bd',
    venueId: 'aukstaitijos',
    name: 'Aukštaitijos Padelio Klubas',
    address: 'Parko g. 16, Panevėžys',
    city: 'Panevėžys',
    bookingUrl: 'https://www.winero.lt/arenas',
    indoor: true,
  },
  // ── Kaunas apskritis ─────────────────────────────────────────────────────────
  {
    id: '41bb5931-4468-46e7-96ad-2c958240da9c',
    venueId: 'harmonypark',
    name: 'Harmony Park',
    address: 'Vazgaikiemis, Prienų raj.',
    city: 'Kaunas',
    bookingUrl: 'https://www.winero.lt/arena/harmony-park',
    indoor: false,
  },
]
