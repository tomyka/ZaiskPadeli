// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import type { Court } from '../../server/utils/types'
import { SLOT_MIN, byDayTime, dayMinutes, fromMinutes, hasSlotStarted, toMinutes } from '../../server/utils/time'

/**
 * Bookable sessions: a start time where a court has enough back-to-back free
 * 30-min slots for the chosen duration. This is what the page offers instead
 * of raw slots, since padel is booked as 60/90/120-minute sessions.
 *
 * Relies on court slots being in venue-day order (guaranteed by runScraper).
 */

export interface CourtStart {
  time: string
  /** Total for the whole session, or null when any slot has no price */
  price: number | null
}

export interface CourtSession {
  court: Court
  price: number | null
}

export interface SessionStart {
  time: string
  courts: CourtSession[]
  /** Cheapest priced court for this start, or null when none is priced */
  minPrice: number | null
}

export interface VenueSessions {
  perCourt: { court: Court; starts: CourtStart[] }[]
  /** Every start time offered by at least one court, earliest first */
  starts: SessionStart[]
  minPrice: number | null
}

export type StripCell = { time: string; state: 'free' | 'busy' | 'past' }

function minPriceOf(prices: (number | null)[]): number | null {
  const priced = prices.filter((p): p is number => p !== null)
  return priced.length ? Math.min(...priced) : null
}

/**
 * Start times on one court where `durationMin` of consecutive slots are free,
 * starting no earlier than `earliestMin` (venue-day minutes, see `dayMinutes`).
 * Slots must be contiguous in time, not just adjacent in the array.
 */
export function courtSessionStarts(court: Court, durationMin: number, earliestMin = 0): CourtStart[] {
  const need = Math.max(1, Math.ceil(durationMin / SLOT_MIN))
  const { slots } = court
  const out: CourtStart[] = []
  for (let i = 0; i + need <= slots.length; i++) {
    const start = dayMinutes(slots[i]!.time)
    if (start < earliestMin) continue
    let price: number | null = 0
    let ok = true
    for (let k = 0; k < need; k++) {
      const s = slots[i + k]!
      if (!s.available || dayMinutes(s.time) !== start + k * SLOT_MIN) { ok = false; break }
      price = price === null || s.price === null ? null : price + s.price
    }
    if (ok) out.push({ time: slots[i]!.time, price: price === null ? null : Math.round(price * 100) / 100 })
  }
  return out
}

/** Session starts for a venue's courts, per court and merged by start time. */
export function venueSessions(courts: Court[], durationMin: number, earliestMin = 0): VenueSessions {
  const perCourt = courts.map(court => ({ court, starts: courtSessionStarts(court, durationMin, earliestMin) }))
  const byTime = new Map<string, CourtSession[]>()
  for (const { court, starts } of perCourt) {
    for (const { time, price } of starts) {
      const list = byTime.get(time) ?? []
      list.push({ court, price })
      byTime.set(time, list)
    }
  }
  // Map keeps insertion order, which is per court; re-merge into venue-day order
  const starts = [...byTime]
    .sort(([a], [b]) => byDayTime(a, b))
    .map(([time, list]) => ({ time, courts: list, minPrice: minPriceOf(list.map(c => c.price)) }))
  return { perCourt, starts, minPrice: minPriceOf(starts.map(s => s.minPrice)) }
}

/**
 * One cell per 30-min slot across the venue's day: free if any court has it
 * free, past if it has started (`currentMinutes` from `currentMinutesFor`).
 */
export function dayStrip(courts: Court[], currentMinutes: number): StripCell[] {
  const free = new Map<string, boolean>()
  for (const court of courts)
    for (const s of court.slots)
      free.set(s.time, (free.get(s.time) ?? false) || s.available)
  return [...free]
    .sort(([a], [b]) => byDayTime(a, b))
    .map(([time, isFree]) => ({
      time,
      state: hasSlotStarted(time, currentMinutes) ? 'past' : isFree ? 'free' : 'busy',
    }))
}

/** "18:00" + 90 → "19:30" */
export function sessionEnd(time: string, durationMin: number): string {
  return fromMinutes((toMinutes(time) + durationMin) % 1440)
}
