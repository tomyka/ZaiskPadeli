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

  const courts: Court[] = []
  for (const court of data.result) {
    // Only include padel courts (skip squash)
    if (!court.tab?.toLowerCase().includes('padel')) continue

    const name = (court.name || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    const isDoubles = name.toLowerCase().includes('dvejet')
    const isSingles = name.toLowerCase().includes('vienet')

    // timeIdentifier counts half hours from midnight: 14 = 07:00, 15 = 07:30, ...
    const slots: TimeSlot[] = court.times.map((t: any) => ({
      time: fromMinutes(t.timeIdentifier * 30),
      available: !t.isReserved,
      price: t.price ?? null,
    }))

    courts.push({
      id: `${venue.id}-${court.id}`,
      name: name
        .replace(/Padelio (?:dvejetų|vienetų) kortas\s*/i, '')
        .replace(/\s*[„"",,]+\s*/g, ' ')
        .replace(/^\d+\s*/, (m: string) => `#${m.trim()} `)
        .trim() || `Kortas ${court.id}`,
      type: isSingles ? 'singles' : isDoubles ? 'doubles' : 'unknown',
      slots,
    })
  }
  return courts
}
