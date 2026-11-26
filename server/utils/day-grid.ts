import type { TimeSlot } from './types'
import { dayMinutes, fromMinutes, isSlotOver, SLOT_MIN, toEndMinutes, toMinutes } from './time'

/**
 * A venue's day as half-hour slots: the one place scrapers turn upstream data into TimeSlots.
 *
 * Scrapers translate their platform's data into cells (time, free upstream, price);
 * this module owns the rules every venue shares:
 *   - slots are 30 minutes; a day can run past midnight (see the venue-day clock in time.ts)
 *   - a slot that has already ended is never available, whatever upstream says
 *   - only available slots carry a price
 */

export interface SlotCell {
  /** "HH:MM" start, venue-day clock ("00:30" after a late evening is end of day) */
  time: string
  /** Upstream says it can be booked */
  free: boolean
  /** € per half hour, if known */
  price: number | null
}

/** Cells → TimeSlots; `currentMinutes` from currentMinutesFor (-1 = not today) */
export function toSlots(cells: Iterable<SlotCell>, currentMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (const { time, free, price } of cells) {
    const available = free && !isSlotOver(time, currentMinutes)
    slots.push({ time, available, price: available ? price : null })
  }
  return slots
}

/**
 * Slot start times from opening to closing. A close before the open is after midnight
 * ("08:00"–"02:00" runs to 02:00), "00:00" means midnight, and open = close is closed.
 */
export function openingSlots(open: string, close: string): string[] {
  const start = toMinutes(open)
  let end = toEndMinutes(close)
  if (end < start) end += 1440
  const times: string[] = []
  for (let m = start; m < end; m += SLOT_MIN) times.push(fromMinutes(m % 1440))
  return times
}

/** A booked range as "HH:MM" clock times; the end may be after midnight */
export interface ClockRange { start: string; end: string }

/** Predicate: does the half hour starting at `time` overlap any booked range? */
export function bookedAt(ranges: Iterable<ClockRange>): (time: string) => boolean {
  const spans = [...ranges].map(({ start, end }) => {
    const s = dayMinutes(start)
    let e = dayMinutes(end)
    if (e <= s) e += 1440 // ends at or after midnight
    return [s, e] as const
  })
  return (time) => {
    const m = dayMinutes(time)
    return spans.some(([s, e]) => m < e && m + SLOT_MIN > s)
  }
}

/** Upstream per-hour price → our per-half-hour price */
export function perHalfHour(perHour: number | null | undefined): number | null {
  return perHour == null ? null : perHour / 2
}
