import type { Court } from './types'
import { fetchViaProxy } from './cf-proxy'
import { fetchGoPadelDay, type GoPadelAvailability, type GoPadelDay, type GoPadelFacility } from './gopadel-fetch'

/**
 * GO Padel, Alytus: the club's own booking app (gopadel.lt/rezervuoti).
 * Fetching lives in gopadel-fetch.ts (shared with the cf-proxy Worker); this file parses.
 */

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

/** Through the cf-proxy Worker in production (api.gopadel.lt is behind Cloudflare), directly in local dev */
export async function scrapeGoPadel(date: string, venue: { id: string }): Promise<Court[]> {
  const day = (await fetchViaProxy<GoPadelDay & { error?: string }>('gopadel', date)) ?? await fetchGoPadelDay(date)
  if (!day.facility || !day.availability) throw new Error(`Proxy returned no data${'error' in day && day.error ? `: ${day.error}` : ''}`)
  return parseGoPadel(day.facility, day.availability, venue.id)
}
