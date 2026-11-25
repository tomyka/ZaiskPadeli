import type { Court } from './types'
import { extractSetCookies } from './cookies'

/**
 * GO Padel, Alytus: the club's own booking app (gopadel.lt/rezervuoti).
 *
 * Public API at https://api.gopadel.lt, used the same way the booking page does:
 *   POST /session                                   → anonymous visitor session cookie
 *   GET  /facilities                                → courts (id, name) of the padel facility
 *   GET  /facilities/1/availability?date=YYYY-MM-DD → per court, half-hour slots:
 *        { start: "16:00", status: "available" | "occupied" | "past", pricePerHour: 36 }
 */

const API = 'https://api.gopadel.lt'
const FACILITY_ID = 1
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface Envelope<T> { success: boolean; message?: string | null; data: T }

export interface GoPadelFacility {
  id: number
  courts: { id: number; name: string }[]
}

export interface GoPadelAvailability {
  courts: { courtId: number; slots: { start: string; status: string; pricePerHour: number | null }[] }[]
}

/** Pure: facility + availability → Court[]. Prices are per half hour (the API gives per hour). */
export function parseGoPadel(facility: GoPadelFacility, availability: GoPadelAvailability, idPrefix: string): Court[] {
  const names = new Map(facility.courts.map(c => [c.id, c.name]))
  return availability.courts.map(c => ({
    id: `${idPrefix}-${c.courtId}`,
    name: names.get(c.courtId) ?? `Kortas ${c.courtId}`,
    type: 'doubles',
    slots: c.slots.map((s) => {
      const available = s.status === 'available'
      return { time: s.start, available, price: available && s.pricePerHour != null ? s.pricePerHour / 2 : null }
    }),
  }))
}

export async function scrapeGoPadel(date: string, venue: { id: string }): Promise<Court[]> {
  const session = await fetch(`${API}/session`, { method: 'POST', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
  if (!session.ok) throw new Error(`Session HTTP ${session.status}`)
  const cookie = extractSetCookies(session.headers).join('; ')

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', Cookie: cookie },
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await res.json()) as Envelope<T>
    if (!res.ok || !body.success) throw new Error(`${path}: HTTP ${res.status} ${body.message ?? ''}`.trim())
    return body.data
  }

  const [facilities, availability] = await Promise.all([
    get<GoPadelFacility[]>('/facilities'),
    get<GoPadelAvailability>(`/facilities/${FACILITY_ID}/availability?date=${date}`),
  ])
  const facility = facilities.find(f => f.id === FACILITY_ID)
  if (!facility) throw new Error('Padel facility not found')
  return parseGoPadel(facility, availability, venue.id)
}
