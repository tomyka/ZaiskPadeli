import type { Court, TimeSlot, Venue } from '../../server/utils/types'
import type { Municipality } from '../../server/utils/regions'

/** A court from a pattern: one char per 30-min slot from `first`; '1' free, '0' booked. */
export function court(id: string, pattern: string, first = '18:00', price: number | null = 10, over: Partial<Court> = {}): Court {
  const [h, m] = first.split(':').map(Number) as [number, number]
  const slots: TimeSlot[] = pattern.split('').map((c, i) => {
    const min = (h * 60 + m + i * 30) % 1440
    const time = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    return { time, available: c === '1', price }
  })
  return { id, name: id, type: 'doubles', slots, ...over }
}

export function venue(id: string, municipality: Municipality, courts: Court[], over: Partial<Venue> = {}): Venue {
  return { id, name: id, address: '', municipality, bookingUrl: `https://${id}.example`, courts, lastUpdated: '', status: 'ok', ...over }
}
