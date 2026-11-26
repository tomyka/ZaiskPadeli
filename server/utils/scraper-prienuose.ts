import type { Court } from './types'
import { openingSlots, toSlots } from './day-grid'
import { currentMinutesFor } from './time'

/**
 * Padelis Prienuose scraper.
 *
 * Public API: GET https://padelisprienuose.lt/api/booked-dates
 * Returns all bookings ever: [{date, time_id, order_id, customer_name}]
 * We filter to the requested date to determine booked slots.
 */

const BOOKED_DATES_URL = 'https://padelisprienuose.lt/api/booked-dates'

/** Slot ids from the site's frontend: id 1 = 08:00 … id 28 = 21:30, all €8 per 30 min */
const FIRST_SLOT = '08:00'
const LAST_SLOT_END = '22:00'
const PRICE_PER_SLOT = 8

export interface PrienuoseBooking { date: string; time_id: number | string }

/** Pure: every booking ever → the one court's slots for `date` */
export function buildPrienuoseCourts(bookings: PrienuoseBooking[], date: string, idPrefix: string, currentMinutes = -1): Court[] {
  const bookedIds = new Set(bookings.filter(b => b.date === date).map(b => Number(b.time_id)))
  const cells = openingSlots(FIRST_SLOT, LAST_SLOT_END).map((time, i) => ({ time, free: !bookedIds.has(i + 1), price: PRICE_PER_SLOT }))
  return [{ id: `${idPrefix}-1`, name: 'Kortas', type: 'doubles', slots: toSlots(cells, currentMinutes) }]
}

export async function scrapePrienuose(date: string, venue: { id: string }): Promise<Court[]> {
  const resp = await fetch(BOOKED_DATES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)
  // NB: the endpoint returns every booking ever made; buildPrienuoseCourts keeps the requested date
  return buildPrienuoseCourts((await resp.json()) as PrienuoseBooking[], date, venue.id, currentMinutesFor(date))
}
