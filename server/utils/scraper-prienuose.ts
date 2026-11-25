import type { Venue, TimeSlot } from './types'
import { currentMinutesFor, isSlotOver } from './time'

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
const BOOKING_URL = 'https://padelisprienuose.lt/booking'

/** Fixed time slots from the site's frontend (id → {start, end, price}) */
const TIME_SLOTS: Array<{ id: number; start: string; end: string; price: number }> = [
  { id:  1, start: '08:00', end: '08:30', price: 8 },
  { id:  2, start: '08:30', end: '09:00', price: 8 },
  { id:  3, start: '09:00', end: '09:30', price: 8 },
  { id:  4, start: '09:30', end: '10:00', price: 8 },
  { id:  5, start: '10:00', end: '10:30', price: 8 },
  { id:  6, start: '10:30', end: '11:00', price: 8 },
  { id:  7, start: '11:00', end: '11:30', price: 8 },
  { id:  8, start: '11:30', end: '12:00', price: 8 },
  { id:  9, start: '12:00', end: '12:30', price: 8 },
  { id: 10, start: '12:30', end: '13:00', price: 8 },
  { id: 11, start: '13:00', end: '13:30', price: 8 },
  { id: 12, start: '13:30', end: '14:00', price: 8 },
  { id: 13, start: '14:00', end: '14:30', price: 8 },
  { id: 14, start: '14:30', end: '15:00', price: 8 },
  { id: 15, start: '15:00', end: '15:30', price: 8 },
  { id: 16, start: '15:30', end: '16:00', price: 8 },
  { id: 17, start: '16:00', end: '16:30', price: 8 },
  { id: 18, start: '16:30', end: '17:00', price: 8 },
  { id: 19, start: '17:00', end: '17:30', price: 8 },
  { id: 20, start: '17:30', end: '18:00', price: 8 },
  { id: 21, start: '18:00', end: '18:30', price: 8 },
  { id: 22, start: '18:30', end: '19:00', price: 8 },
  { id: 23, start: '19:00', end: '19:30', price: 8 },
  { id: 24, start: '19:30', end: '20:00', price: 8 },
  { id: 25, start: '20:00', end: '20:30', price: 8 },
  { id: 26, start: '20:30', end: '21:00', price: 8 },
  { id: 27, start: '21:00', end: '21:30', price: 8 },
  { id: 28, start: '21:30', end: '22:00', price: 8 },
]

export async function scrapePrienuose(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'prienuose',
    name: 'Padelis Prienuose',
    address: 'Ropių g. 44, Prienai',
    city: 'Kaunas',
    bookingUrl: BOOKING_URL,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const resp = await fetch(BOOKED_DATES_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
    })

    if (!resp.ok) {
      venue.error = `API returned ${resp.status}`
      return venue
    }

    const allBookings: Array<{ date: string; time_id: number }> = await resp.json()

    // Collect booked slot IDs for the requested date
    const bookedIds = new Set<number>(
      allBookings.filter(b => b.date === date).map(b => Number(b.time_id))
    )

    const currentMinutes = currentMinutesFor(date)

    const slots: TimeSlot[] = TIME_SLOTS.map(slot => {
      const isPast = isSlotOver(slot.start, currentMinutes)
      const isBooked = bookedIds.has(slot.id)
      const available = !isPast && !isBooked
      return {
        time: slot.start,
        available,
        price: available ? slot.price : null,
      }
    })

    venue.courts.push({
      id: 'prienuose-1',
      name: 'Kortas',
      type: 'doubles',
      indoor: false,
      slots,
    })
  } catch (err) {
    console.warn('[prienuose] scrape failed:', (err as Error).message)
    venue.error = 'Failed to fetch Padelis Prienuose data'
  }

  return venue
}
