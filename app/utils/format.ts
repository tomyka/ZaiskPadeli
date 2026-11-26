// Relative import (not ~~/) so vitest can load this file without Nuxt's aliases
import { dayMinutes } from '../../server/utils/time'

/** "14:05" — clock time of an ISO timestamp in Lithuanian time (same on server and client) */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vilnius' })
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

/** "naktį" for a start after midnight: it belongs to the night after the selected day, so say so */
export function nightTag(time: string): string {
  return dayMinutes(time) >= 1440 ? 'naktį' : ''
}

/** When data was fetched: "14:05" if today (LT), else "11-25 14:05", e.g. a day shown offline */
export function formatUpdated(iso: string, today: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Vilnius' })
  return day === today ? formatClock(iso) : `${day.slice(5)} ${formatClock(iso)}`
}
