/**
 * Lithuanian timezone + clock-time utilities.
 * All server code must use these instead of `new Date().toISOString().split('T')[0]`
 * or `now.getHours()`, as Vercel runs in UTC.
 *
 * Every function that depends on "now" accepts an optional `now` so it can be tested
 * deterministically.
 */

const LT_TZ = 'Europe/Vilnius'
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const CLOCK_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/

/** Today's date in Lithuanian timezone, formatted as YYYY-MM-DD */
export function todayLT(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: LT_TZ })
}

/** Current time in Lithuanian timezone, in minutes since midnight (H * 60 + M) */
export function nowLTMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

/** Is the given YYYY-MM-DD date string today in Lithuanian timezone? */
export function isDateTodayLT(date: string, now: Date = new Date()): boolean {
  return date === todayLT(now)
}

/**
 * Minutes elapsed today (LT) if `date` is today, otherwise -1.
 * Scrapers use this to mark already-finished slots as unavailable.
 */
export function currentMinutesFor(date: string, now: Date = new Date()): number {
  return isDateTodayLT(date, now) ? nowLTMinutes(now) : -1
}

// ── Venue-day clock ──
// A venue's day runs past midnight: Padel House sells 00:00–01:30 slots on the
// same date's grid. Those belong to the END of that day, not its start.

/** Every venue's grid is in 30-minute slots */
export const SLOT_MIN = 30

/** No venue opens this early, so earlier clock times are past midnight, at the end of the venue's day */
const DAY_START_MIN = 4 * 60

/**
 * Minutes into the venue's day: like `toMinutes`, but "00:30" after a late
 * evening is 1470, not 30, so after-midnight slots sort and compare correctly.
 */
export function dayMinutes(time: string): number {
  const m = toMinutes(time)
  return m < DAY_START_MIN ? m + 1440 : m
}

/** Sorts clock times in venue-day order (evening before after-midnight). */
export function byDayTime(a: string, b: string): number {
  return dayMinutes(a) - dayMinutes(b)
}

/**
 * True if a slot starting at `time` (lasting `durationMin`) has already ended.
 * `currentMinutes` comes from `currentMinutesFor` (-1 = not today: nothing is over).
 */
export function isSlotOver(time: string, currentMinutes: number, durationMin = SLOT_MIN): boolean {
  return currentMinutes >= 0 && dayMinutes(time) + durationMin <= currentMinutes
}

/** True if a slot starting at `time` has already begun (too late to book). */
export function hasSlotStarted(time: string, currentMinutes: number): boolean {
  return currentMinutes >= 0 && dayMinutes(time) < currentMinutes
}

/** Strict YYYY-MM-DD check, including calendar validity (rejects 2026-02-31). */
export function isValidIsoDate(date: string): boolean {
  const m = ISO_DATE_RE.exec(date)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** Add (or subtract) whole days to a YYYY-MM-DD string. Timezone-independent. */
export function addDays(date: string, days: number): string {
  const m = ISO_DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid ISO date: ${date}`)
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12))
  return dt.toISOString().slice(0, 10)
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD string. Timezone-independent. */
export function dayOfWeek(date: string): number {
  const m = ISO_DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid ISO date: ${date}`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
}

/** N consecutive dates starting from today (LT), today first. */
export function nextDatesLT(count: number, now: Date = new Date()): string[] {
  const today = todayLT(now)
  return Array.from({ length: count }, (_, i) => addDays(today, i))
}

/** N consecutive dates going backwards from today (LT), today first. */
export function pastDatesLT(count: number, now: Date = new Date()): string[] {
  const today = todayLT(now)
  return Array.from({ length: count }, (_, i) => addDays(today, -i))
}

/**
 * "HH:MM" or "HH:MM:SS" → minutes since midnight.
 * "00:00" is returned as 0; use `toEndMinutes` for range ends where midnight means 1440.
 * Throws on malformed input so bad upstream data surfaces as a venue error.
 */
export function toMinutes(t: string): number {
  const m = CLOCK_RE.exec(t.trim())
  if (!m) throw new Error(`Invalid clock time: ${t}`)
  return Number(m[1]) * 60 + Number(m[2])
}

/** Like `toMinutes`, but treats midnight ("00:00"/"24:00") as end of day (1440). */
export function toEndMinutes(t: string): number {
  const min = toMinutes(t)
  return min === 0 ? 1440 : min
}

/** Minutes since midnight → "HH:MM" */
export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/** How far ahead availability can be requested; the API and the date picker share it */
export const MAX_DAYS_AHEAD = 180
