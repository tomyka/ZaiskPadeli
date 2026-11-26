import type { Court, CourtKind } from './types'
import { openingSlots, perHalfHour, toSlots } from './day-grid'
import { currentMinutesFor, dayMinutes, dayOfWeek } from './time'
import { BROWSER_UA } from './user-agent'

/**
 * Padel in, Marijampolė (padelin.lt): the club's own reservation page.
 *
 * Public endpoint used by that page when a court is picked:
 *   GET /pages/getplayabletimes?FIELD=f1&DATE=YYYY-MM-DD&Starting_time=480
 * → an HTML <select> whose options are the free half-hour start times for that court.
 * A start is offered even when the next half hour is booked, so a listed time = a free slot.
 *
 * Open 07:00–23:00. Prices are published on /pages/padelin/Kainos (per hour, below).
 */

const BASE = 'https://padelin.lt'
const OPEN = '07:00'
const CLOSE = '23:00'

const COURTS: { field: string; name: string; type: CourtKind }[] = [
  { field: 'f1', name: 'NR. 1', type: 'doubles' },
  { field: 'f2', name: 'NR. 2', type: 'doubles' },
  { field: 'f3', name: 'NR. 3', type: 'singles' },
]

/** € per hour: weekdays before / from 16:00, weekends all day */
const PRICE_PER_HOUR: Record<CourtKind, { weekdayDay: number; weekdayEvening: number; weekend: number }> = {
  doubles: { weekdayDay: 24, weekdayEvening: 32, weekend: 28 },
  singles: { weekdayDay: 18, weekdayEvening: 22, weekend: 20 },
}

/** Pure: the endpoint's <select> HTML → free start times ("HH:MM") */
export function parsePadelinTimes(html: string): string[] {
  return [...html.matchAll(/<option value="(\d{2}:\d{2})"/g)].map(m => m[1]!)
}

/** € per half hour for a slot on `date` */
export function padelinSlotPrice(type: CourtKind, date: string, time: string): number {
  const p = PRICE_PER_HOUR[type]
  const dow = dayOfWeek(date)
  const perHour = dow === 0 || dow === 6 ? p.weekend : dayMinutes(time) < 16 * 60 ? p.weekdayDay : p.weekdayEvening
  return perHalfHour(perHour)!
}

/** Pure: free start times per court → Court[] over the opening hours */
export function buildPadelinCourts(freeByField: Record<string, string[]>, date: string, idPrefix: string, currentMinutes = -1): Court[] {
  const times = openingSlots(OPEN, CLOSE)
  return COURTS.map((c) => {
    const free = new Set(freeByField[c.field] ?? [])
    return {
      id: `${idPrefix}-${c.field}`,
      name: c.name,
      type: c.type,
      slots: toSlots(times.map(time => ({ time, free: free.has(time), price: padelinSlotPrice(c.type, date, time) })), currentMinutes),
    }
  })
}

export async function scrapePadelin(date: string, venue: { id: string }): Promise<Court[]> {
  // The page always sends Starting_time=480; the endpoint ignores it (420, 480 and 600 list the same times)
  const entries = await Promise.all(COURTS.map(async (c) => {
    const res = await fetch(`${BASE}/pages/getplayabletimes?FIELD=${c.field}&DATE=${date}&Starting_time=480`, {
      headers: { 'User-Agent': BROWSER_UA, 'X-Requested-With': 'XMLHttpRequest' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`${c.field}: HTTP ${res.status}`)
    const html = await res.text()
    if (!html.includes('start_of_play')) throw new Error(`${c.field}: unexpected response`)
    return [c.field, parsePadelinTimes(html)] as const
  }))
  return buildPadelinCourts(Object.fromEntries(entries), date, venue.id, currentMinutesFor(date))
}
