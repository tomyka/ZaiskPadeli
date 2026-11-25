import type { Venue, TimeSlot } from './types'
import { currentMinutesFor, isSlotOver } from './time'

/**
 * K-Padel scraper — uses the Moove.lt / ActiveZone platform.
 *
 * Public endpoint (no auth required):
 *   GET https://app.moove.lt/api/v1/settings/tickets/user
 *   ?locationIds=227&sport=padel&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&size=300
 *
 * Returns all time-slot "tickets" for the day. Status "free" = available.
 * Price is in euro cents (1000 = €10).
 */

const API_BASE = 'https://app.moove.lt/api/v1/settings/tickets/user'
const LOCATION_ID = 227
const BOOKING_URL = 'https://app.moove.lt/padel/reservation'

const SKIP_COURTS = ['kamuoliukų mašina', 'ball machine']

interface MooveTicket {
  id: number
  court: {
    id: number
    name: string
    uiSort?: string
  }
  ticketTime: string   // "HH:mm:ss"
  price: number        // cents
  status: string       // "free" | "paid" | "ordered" | "reserved" | ...
}

interface MooveResponse {
  content: MooveTicket[]
  totalElements: number
  totalPages: number
}

export async function scrapeKPadel(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'kpadel',
    name: 'K-Padel',
    address: 'Ramygalos g. 149E, Panevėžys',
    city: 'Panevėžys',
    bookingUrl: BOOKING_URL,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const url = `${API_BASE}?locationIds=${LOCATION_ID}&sport=padel&dateFrom=${date}&dateTo=${date}&size=300`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
    })

    if (!resp.ok) {
      venue.error = `API returned ${resp.status}`
      return venue
    }

    const data: MooveResponse = await resp.json()
    const currentMinutes = currentMinutesFor(date)

    // Group tickets by court id
    const courtMap = new Map<number, { name: string; sort: string; tickets: MooveTicket[] }>()
    for (const ticket of data.content ?? []) {
      const courtName = ticket.court.name
      if (SKIP_COURTS.some(s => courtName.toLowerCase().includes(s))) continue

      if (!courtMap.has(ticket.court.id)) {
        courtMap.set(ticket.court.id, {
          name: courtName,
          sort: ticket.court.uiSort ?? '99',
          tickets: [],
        })
      }
      courtMap.get(ticket.court.id)!.tickets.push(ticket)
    }

    // Sort courts by uiSort
    const sorted = [...courtMap.entries()].sort((a, b) =>
      a[1].sort.localeCompare(b[1].sort, undefined, { numeric: true })
    )

    for (const [courtId, { name, tickets }] of sorted) {
      // Sort tickets by time
      tickets.sort((a, b) => a.ticketTime.localeCompare(b.ticketTime))

      const slots: TimeSlot[] = tickets.map(t => {
        const hhmm = t.ticketTime.slice(0, 5)  // "HH:mm"
        const isAvailable = !isSlotOver(hhmm, currentMinutes) && t.status === 'free'

        return {
          time: hhmm,
          available: isAvailable,
          price: isAvailable ? t.price / 100 : null,
        }
      })

      venue.courts.push({
        id: `kpadel-${courtId}`,
        name,
        type: 'doubles',
        indoor: !name.toLowerCase().includes('laukas'),
        slots,
      })
    }

    if (venue.courts.length === 0) {
      venue.error = 'Nėra duomenų'
    }
  } catch (err) {
    console.warn('[kpadel] scrape failed:', (err as Error).message)
    venue.error = 'Nepavyko gauti K-Padel duomenų'
  }

  return venue
}
