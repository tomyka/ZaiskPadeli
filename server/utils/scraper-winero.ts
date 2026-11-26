import type { Court } from './types'
import { bookedAt, openingSlots, perHalfHour, toSlots } from './day-grid'
import { courtTypeFromName } from './parse'
import { currentMinutesFor, dayOfWeek, toEndMinutes, toMinutes } from './time'

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

function priceIn(slots: WineroTimeSlot[] | undefined, slotTime: string): number | null {
  const slotMin = toMinutes(slotTime)
  for (const ts of slots ?? []) {
    if (slotMin >= toMinutes(ts.start_time) && slotMin < toEndMinutes(ts.end_time)) return perHalfHour(ts.price)
  }
  return null
}

/** Per-30-min price for a slot. Exception periods (date-ranged) take precedence over regular ones. */
export function getPriceForSlot(court: WineroCourt, date: string, slotTime: string): number | null {
  const day = DAY_NAMES[dayOfWeek(date)]!.toLowerCase()

  for (const exc of court.exception_price_periods ?? []) {
    // ISO dates compare correctly as strings
    if (exc.days.includes(day) && date >= exc.start_date && date <= exc.end_date) {
      const price = priceIn(exc.time_slots, slotTime)
      if (price !== null) return price
    }
  }
  for (const period of court.price_periods ?? []) {
    if (!period.days.includes(day)) continue
    const price = priceIn(period.time_slots, slotTime)
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

/** One day's arena + public-availability responses (the fields we use) */
export interface WineroDay {
  arena: { id?: string; opening_hours?: string; courts?: WineroCourt[] }
  booked: { court_id: string; start_time: string; end_time: string }[]
}

/** Pure: one day's API data → Court[] over the arena's opening hours */
export function buildWineroCourts(day: WineroDay, config: WineroArenaConfig, date: string, idPrefix: string, currentMinutes = -1): Court[] {
  const hours = parseOpeningHours(day.arena.opening_hours ?? '', date)
  if (!hours) throw new Error('Could not parse opening hours')
  const times = openingSlots(hours.open, hours.close)
  const skip = (config.skipCourts ?? []).map(s => s.toLowerCase())

  return (day.arena.courts ?? [])
    .filter(court => !skip.some(s => court.name.toLowerCase().includes(s)))
    .map((court) => {
      const isBooked = bookedAt(day.booked.filter(b => b.court_id === court.id).map(b => ({ start: b.start_time, end: b.end_time })))
      return {
        id: `${idPrefix}-${court.id}`,
        name: court.name,
        type: courtTypeFromName(court.name),
        slots: toSlots(times.map(time => ({ time, free: !isBooked(time), price: getPriceForSlot(court, date, time) })), currentMinutes),
      }
    })
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

/**
 * Build a scraper for one Winero arena. Court ids are prefixed with the venue id.
 *
 * Only for arenas that take bookings through Winero (`reservation: true` in
 * GET https://www.winero.lt/api/arenas). Winero also lists venues that book elsewhere;
 * their public availability is always empty, so every slot would show as free (#41).
 */
export function wineroScraper(config: WineroArenaConfig) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const [arena, availability] = await Promise.all([
      getJson(`${WINERO_BASE}/api/arenas/${config.arenaId}`),
      getJson(`${WINERO_BASE}/api/bookings/public-availability?arena_id=${config.arenaId}&date=${date}`),
    ])
    if (!arena?.id) throw new Error('Arena not found')
    return buildWineroCourts({ arena, booked: availability?.data ?? [] }, config, date, venue.id, currentMinutesFor(date))
  }
}
