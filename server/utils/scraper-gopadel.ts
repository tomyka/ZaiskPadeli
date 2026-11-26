import type { Court } from './types'
import { perHalfHour, toSlots } from './day-grid'
import { fetchProtectedDay } from './protected-fetch'
import type { GoPadelAvailability, GoPadelFacility } from './gopadel-fetch'
import { currentMinutesFor } from './time'

/**
 * GO Padel, Alytus: the club's own booking app (gopadel.lt/rezervuoti).
 * api.gopadel.lt is behind Cloudflare, so the day is fetched through the protected-site
 * fetch (cf-proxy Worker in production); this file parses.
 */

/** Pure: facility + availability → Court[]. The API gives per-hour prices. */
export function parseGoPadel(facility: GoPadelFacility, availability: GoPadelAvailability, idPrefix: string, currentMinutes = -1): Court[] {
  const names = new Map(facility.courts.map(c => [c.id, c.name]))
  return availability.courts.map(c => ({
    id: `${idPrefix}-${c.courtId}`,
    name: names.get(c.courtId) ?? `Kortas ${c.courtId}`,
    type: 'doubles',
    slots: toSlots(c.slots.map(s => ({ time: s.start, free: s.status === 'available', price: perHalfHour(s.pricePerHour) })), currentMinutes),
  }))
}

export async function scrapeGoPadel(date: string, venue: { id: string }): Promise<Court[]> {
  const { facility, availability } = await fetchProtectedDay('gopadel', date)
  return parseGoPadel(facility, availability, venue.id, currentMinutesFor(date))
}
