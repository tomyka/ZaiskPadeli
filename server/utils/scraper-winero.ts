import type { Court, TimeSlot } from './types'
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
  /** Winero arena UUID */
  arenaId: string
  /** Court name substrings to skip (case-insensitive), e.g. ball machines */
  skipCourts?: string[]
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

/** Build a scraper for one Winero arena. Court ids are prefixed with the venue id. */
export function wineroScraper(config: WineroArenaConfig) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const [arenaData, availData] = await Promise.all([
      getJson(`${WINERO_BASE}/api/arenas/${config.arenaId}`),
      getJson(`${WINERO_BASE}/api/bookings/public-availability?arena_id=${config.arenaId}&date=${date}`),
    ])
    if (!arenaData?.id) throw new Error('Arena not found')

    // Booked ranges per court
    const bookedMap = new Map<string, Array<{ start: number; end: number }>>()
    for (const slot of availData?.data ?? []) {
      const ranges = bookedMap.get(slot.court_id) ?? []
      ranges.push({ start: toMinutes(slot.start_time), end: toEndMinutes(slot.end_time) })
      bookedMap.set(slot.court_id, ranges)
    }

    const hours = parseOpeningHours(arenaData.opening_hours ?? '', date)
    if (!hours) throw new Error('Could not parse opening hours')

    const slotTimes = halfHourSlots(hours.open, hours.close)
    const currentMinutes = currentMinutesFor(date)
    const courts: WineroCourt[] = arenaData.courts ?? []

    return courts
      .filter(court => !config.skipCourts?.some(s => court.name.toLowerCase().includes(s.toLowerCase())))
      .map(court => {
        const booked = bookedMap.get(court.id) ?? []
        const slots: TimeSlot[] = slotTimes.map(time => {
          const slotStart = toMinutes(time)
          const isBooked = booked.some(b => b.start < slotStart + 30 && b.end > slotStart)
          const available = !isSlotOver(time, currentMinutes) && !isBooked
          return { time, available, price: available ? getPriceForSlot(court, date, time) : null }
        })
        return {
          id: `${venue.id}-${court.id}`,
          name: court.name,
          type: court.name.toLowerCase().includes('single') ? 'singles' as const : 'doubles' as const,
          slots,
        }
      })
  }
}
