import type { Court, TimeSlot } from './types'
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

export async function scrapeKPadel(date: string, venue: { id: string }): Promise<Court[]> {
  const url = `${API_BASE}?locationIds=${LOCATION_ID}&sport=padel&dateFrom=${date}&dateTo=${date}&size=300`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`API returned ${resp.status}`)

  const data: MooveResponse = await resp.json()
  const currentMinutes = currentMinutesFor(date)

  // Group tickets by court
  const byCourt = new Map<number, { name: string; sort: string; tickets: MooveTicket[] }>()
  for (const ticket of data.content ?? []) {
    const name = ticket.court.name
    if (SKIP_COURTS.some(s => name.toLowerCase().includes(s))) continue
    const entry = byCourt.get(ticket.court.id) ?? { name, sort: ticket.court.uiSort ?? '99', tickets: [] }
    entry.tickets.push(ticket)
    byCourt.set(ticket.court.id, entry)
  }

  return [...byCourt.entries()]
    .sort((a, b) => a[1].sort.localeCompare(b[1].sort, undefined, { numeric: true }))
    .map(([courtId, { name, tickets }]) => {
      const slots: TimeSlot[] = tickets
        .sort((a, b) => a.ticketTime.localeCompare(b.ticketTime))
        .map(t => {
          const time = t.ticketTime.slice(0, 5) // "HH:mm"
          const available = !isSlotOver(time, currentMinutes) && t.status === 'free'
          return { time, available, price: available ? t.price / 100 : null }
        })
      return {
        id: `${venue.id}-${courtId}`,
        name,
        type: 'doubles' as const,
        indoor: !name.toLowerCase().includes('laukas'), // "laukas" = outdoor court
        slots,
      }
    })
}
