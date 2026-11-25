import type { Court } from '../../server/utils/types'
import { toMinutes } from '../../server/utils/time'

/**
 * Bookable sessions: a start time where a court has enough back-to-back free
 * 30-min slots for the chosen duration. This is what the page offers instead
 * of raw slots, since padel is booked as 60/90/120-minute sessions.
 */

export const DURATIONS = [60, 90, 120] as const
export type Duration = typeof DURATIONS[number]
export const DEFAULT_DURATION: Duration = 90

export function isDuration(v: unknown): v is Duration {
  return DURATIONS.includes(v as Duration)
}

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

const SLOT_MIN = 30
/** No venue opens this early, so earlier clock times are past midnight, at the end of the venue's day */
const DAY_START_MIN = 4 * 60

/**
 * Minutes into the venue's day: like `toMinutes`, but "00:30" after a late
 * evening is 1470, not 30, so after-midnight slots sort and join correctly.
 */
export function dayMinutes(time: string): number {
  const m = toMinutes(time)
  return m < DAY_START_MIN ? m + 1440 : m
}

/** Sorts clock times in venue-day order (evening before after-midnight). */
export function byDayTime(a: string, b: string): number {
  return dayMinutes(a) - dayMinutes(b)
}

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
  const starts = [...byTime]
    .sort(([a], [b]) => byDayTime(a, b))
    .map(([time, list]) => ({ time, courts: list, minPrice: minPriceOf(list.map(c => c.price)) }))
  return { perCourt, starts, minPrice: minPriceOf(starts.map(s => s.minPrice)) }
}

/**
 * One cell per 30-min slot across the venue's day: free if any court has it
 * free, past if it starts before `nowMin` (venue-day minutes; -1 for a day that isn't today).
 */
export function dayStrip(courts: Court[], nowMin: number): StripCell[] {
  const free = new Map<string, boolean>()
  for (const court of courts)
    for (const s of court.slots)
      free.set(s.time, (free.get(s.time) ?? false) || s.available)
  return [...free]
    .sort(([a], [b]) => byDayTime(a, b))
    .map(([time, isFree]) => ({
      time,
      state: nowMin >= 0 && dayMinutes(time) < nowMin ? 'past' : isFree ? 'free' : 'busy',
    }))
}

/** "18:00" + 90 → "19:30" */
export function sessionEnd(time: string, durationMin: number): string {
  const end = (toMinutes(time) + durationMin) % 1440
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

/** €42, €40.50 */
export function formatPrice(p: number): string {
  return `€${Number.isInteger(p) ? p : p.toFixed(2)}`
}

/** Lithuanian noun form for a count: 1 kortas, 2 kortai, 10 kortų, 21 kortas. */
export function ltPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2) return few
  return many
}
