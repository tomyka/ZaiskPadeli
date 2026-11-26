import type { Court } from './types'
import { toSlots } from './day-grid'
import { courtTypeFromName } from './parse'
import { currentMinutesFor } from './time'

/**
 * Moove.lt / ActiveZone platform (app.moove.lt, activezone.fun).
 *
 * Public endpoint (no auth required):
 *   GET https://app.moove.lt/api/v1/settings/tickets/user
 *   ?locationIds=<id>&sport=padel&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&size=<PAGE_SIZE>
 *
 * Returns every half-hour "ticket" for the day, booked ones included
 * ("ordered" / "paid" / "reserved" …); "free" = available. Price is in euro cents
 * per ticket (half hour).
 *
 * Location ids: GET https://app.moove.lt/api/v1/settings/locations?size=500 lists every
 * location with its name, address and locationType ("inside" / "outside").
 * Before adding one, check it has real bookings: a location nobody books through
 * shows every slot free (see #41 for the same trap on Winero).
 *
 * Booking links: https://app.moove.lt/padel/club/reservation/<clubId>?locationId=<locationId>
 * (the generic /padel/reservation page doesn't open a given club).
 */

const API_BASE = 'https://app.moove.lt/api/v1/settings/tickets/user'
const SKIP_COURTS = ['kamuoliukų mašina', 'ball machine']
/** One page must hold the whole day: ~30 half hours × courts (10-court clubs need 330+) */
const PAGE_SIZE = 1000

export interface MooveTicket {
  id: number
  court: { id: number; name: string; uiSort?: string }
  ticketTime: string // "HH:mm:ss"
  price: number      // cents per half hour
  status: string     // "free" | "paid" | "ordered" | "reserved" | …
}

export interface MooveConfig {
  locationId: number
  /** Default for the location's courts (indoor when unset); a court named "… laukas" is always outdoor */
  indoor?: boolean
}

/** Pure: one day's tickets → Court[] (courts in the club's own order) */
export function parseMooveTickets(
  tickets: MooveTicket[],
  idPrefix: string,
  currentMinutes: number,
  config: Pick<MooveConfig, 'indoor'> = {},
): Court[] {
  const byCourt = new Map<number, { name: string; sort: string; tickets: MooveTicket[] }>()
  for (const ticket of tickets) {
    const name = ticket.court.name
    if (SKIP_COURTS.some(s => name.toLowerCase().includes(s))) continue
    const entry = byCourt.get(ticket.court.id) ?? { name, sort: ticket.court.uiSort ?? '99', tickets: [] }
    entry.tickets.push(ticket)
    byCourt.set(ticket.court.id, entry)
  }

  return [...byCourt.entries()]
    .sort((a, b) => a[1].sort.localeCompare(b[1].sort, undefined, { numeric: true }))
    .map(([courtId, { name, tickets: courtTickets }]) => ({
      id: `${idPrefix}-${courtId}`,
      name,
      type: courtTypeFromName(name),
      indoor: !name.toLowerCase().includes('laukas') && (config.indoor ?? true),
      slots: toSlots(courtTickets.map(t => ({ time: t.ticketTime.slice(0, 5), free: t.status === 'free', price: t.price / 100 })), currentMinutes),
    }))
}

/** Build a scraper for one Moove location */
export function mooveScraper(config: MooveConfig) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const url = `${API_BASE}?locationIds=${config.locationId}&sport=padel&dateFrom=${date}&dateTo=${date}&size=${PAGE_SIZE}`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`API returned ${resp.status}`)
    const data = (await resp.json()) as { content?: MooveTicket[]; totalElements?: number }
    const tickets = data.content ?? []
    if ((data.totalElements ?? 0) > tickets.length) {
      throw new Error(`Day truncated: ${tickets.length} of ${data.totalElements} tickets`)
    }
    return parseMooveTickets(tickets, venue.id, currentMinutesFor(date), config)
  }
}
