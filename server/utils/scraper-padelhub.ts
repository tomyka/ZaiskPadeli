import type { Court, TimeSlot } from './types'
import { fromMinutes } from './time'

/**
 * Padel Hub — Mokesta API (ABP Framework)
 * Clean REST API, no auth required.
 * GET /api/services/app/Padelhub/GetCourtReservations?date=YYYY-MM-DD
 */
export async function scrapePadelHub(date: string, venue: { id: string }): Promise<Court[]> {
  const url = `https://padelhubsavapi.mokesta.lt/api/services/app/Padelhub/GetCourtReservations?date=${date}`
  const data: any = await $fetch(url, { timeout: 15000 })
  if (!data?.result) throw new Error('No data returned from API')
  return parsePadelHubCourts(data.result, venue.id)
}

/**
 * timeIdentifier is a 1-based half-hour index from midnight: 1 = 00:00, 2 = 00:30, 14 = 06:30.
 * Mirrors the booking site's own `timeDisplay`: hour = floor((id - 1) / 2).
 */
export function padelHubSlotTime(timeIdentifier: number): string {
  return fromMinutes((timeIdentifier - 1) * 30)
}

export function parsePadelHubCourts(result: any[], venueId: string): Court[] {
  const courts: Court[] = []
  for (const court of result) {
    // Only include padel courts (skip squash)
    if (!court.tab?.toLowerCase().includes('padel')) continue

    const name = (court.name || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const isDoubles = name.toLowerCase().includes('dvejet')
    const isSingles = name.toLowerCase().includes('vienet')

    const slots: TimeSlot[] = court.times.map((t: any) => ({
      time: padelHubSlotTime(t.timeIdentifier),
      available: !t.isReserved,
      price: t.price ?? null,
    }))

    courts.push({
      id: `${venueId}-${court.id}`,
      name: name
        .replace(/Padelio (?:dvejetų|vienetų) kortas\s*/i, '')
        .replace(/\s*[„“”",]+\s*/g, ' ')
        .replace(/^\d+\s*/, (m: string) => `#${m.trim()} `)
        .trim() || `Kortas ${court.id}`,
      type: isSingles ? 'singles' : isDoubles ? 'doubles' : 'unknown',
      slots,
    })
  }
  return courts
}
