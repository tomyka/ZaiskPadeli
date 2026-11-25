import type { Court, TimeSlot } from './types'
import { currentMinutesFor, halfHourSlots, isSlotOver } from './time'

/**
 * Padelis Prienuose scraper.
 *
 * Public API: GET https://padelisprienuose.lt/api/booked-dates
 * Returns all bookings ever: [{date, time_id, order_id, customer_name}]
 * We filter to the requested date to determine booked slots.
 *
 * Time slots are fixed (IDs 1–28), defined in the frontend bundle:
 * slot 1 = 08:00–08:30 … slot 28 = 21:30–22:00 (all €8 / 30 min)
 */

const BOOKED_DATES_URL = 'https://padelisprienuose.lt/api/booked-dates'

/** Slot ids from the site's frontend: id 1 = 08:00 … id 28 = 21:30, all €8 per 30 min */
const FIRST_SLOT = '08:00'
const LAST_SLOT_END = '22:00'
const PRICE_PER_SLOT = 8

export async function scrapePrienuose(date: string, venue: { id: string }): Promise<Court[]> {
  const resp = await fetch(BOOKED_DATES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)

  // NB: the endpoint returns every booking ever made — we keep only the requested date
  const allBookings: Array<{ date: string; time_id: number }> = await resp.json()
  const bookedIds = new Set(allBookings.filter(b => b.date === date).map(b => Number(b.time_id)))
  const currentMinutes = currentMinutesFor(date)

  const slots: TimeSlot[] = halfHourSlots(FIRST_SLOT, LAST_SLOT_END).map((time, i) => {
    const available = !bookedIds.has(i + 1) && !isSlotOver(time, currentMinutes)
    return { time, available, price: available ? PRICE_PER_SLOT : null }
  })

  return [{ id: `${venue.id}-1`, name: 'Kortas', type: 'doubles', slots }]
}
