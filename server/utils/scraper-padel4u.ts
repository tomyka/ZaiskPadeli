import type { Court, TimeSlot } from './types'
import { toSlots } from './day-grid'
import { currentMinutesFor } from './time'

/**
 * Padel4U (Kaunas) — custom WordPress "padel-reservations" plugin at padel4u.cloud
 *
 * 1. GET the booking page: it embeds `var padelReservations = {...}` with a WP nonce
 *    and the court list (ids + names).
 * 2. Per court: POST /wp-admin/admin-ajax.php
 *      action=padel_get_available_slots & nonce & court_id & date=YYYY-MM-DD
 *    → { success, data: { slots: [{ start_time, end_time, price, available, reason }] } }
 *    One entry per 30-min slot with its own price; reason = '' | 'booked' | 'tournament'.
 *
 * The club is open until 02:30, and the API lists those after-midnight slots under the
 * same date: they belong to the end of that venue day (see the venue-day clock in time.ts).
 */

const BASE_URL = 'https://padel4u.cloud'
const UA = 'Mozilla/5.0'
const TIMEOUT_MS = 15_000

export interface Padel4uConfig {
  nonce: string
  courts: Array<{ id: number; name: string }>
}

export interface Padel4uSlot {
  start_time: string
  end_time: string
  price: number | null
  available: boolean
  reason?: string
}

/** Extract the nonce + court list the booking page embeds for its own JS. */
export function parsePadel4uConfig(html: string): Padel4uConfig {
  const json = /var padelReservations\s*=\s*(\{.*?\});\s*(?:\n|<\/script>)/s.exec(html)?.[1]
  if (!json) throw new Error('padelReservations config not found on booking page')
  const cfg = JSON.parse(json) as { nonce?: string; courts?: Array<{ id: number; name: string }> }
  if (!cfg.nonce) throw new Error('No nonce in padelReservations config')
  if (!cfg.courts?.length) throw new Error('No courts in padelReservations config')
  return { nonce: cfg.nonce, courts: cfg.courts.map(c => ({ id: c.id, name: c.name })) }
}

/** API slots → our TimeSlots (price is already per 30-min slot). After-midnight slots stay, at the end of the day. */
export function toTimeSlots(slots: Padel4uSlot[], currentMinutes: number): TimeSlot[] {
  return toSlots(slots.map(s => ({ time: s.start_time, free: s.available, price: s.price ?? null })), currentMinutes)
}

/** Normalise "1 kortas" / "2 Kortas" / "4 Metalurga" → "Kortas 1" / "Kortas 2" / "Kortas 4 Metalurga" */
export function courtDisplayName(name: string): string {
  const m = /^(\d+)\s*(.*)$/.exec(name.trim())
  if (!m) return name.trim()
  const rest = m[2]!.replace(/^kortas$/i, '').trim()
  return rest ? `Kortas ${m[1]} ${rest}` : `Kortas ${m[1]}`
}

/** API refuses dates past its booking window with success:false and this message */
const OUTSIDE_WINDOW = /Rezervuoti galima tik iki/i

export async function scrapePadel4u(date: string, venue: { id: string }): Promise<Court[]> {
  const page = await fetch(`${BASE_URL}/`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!page.ok) throw new Error(`Booking page HTTP ${page.status}`)
  // The logged-out WP nonce is not tied to a session cookie (verified), so no cookie jar needed
  const { nonce, courts } = parsePadel4uConfig(await page.text())
  const currentMinutes = currentMinutesFor(date)

  const perCourt = await Promise.all(courts.map(async court => {
    const resp = await fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        action: 'padel_get_available_slots', nonce, court_id: String(court.id), date,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!resp.ok) throw new Error(`Slots HTTP ${resp.status} for court ${court.id}`)
    const body = await resp.json() as { success: boolean; data?: { slots?: Padel4uSlot[]; message?: string } }
    if (!body.success) {
      if (OUTSIDE_WINDOW.test(body.data?.message ?? '')) return null // date not bookable yet
      throw new Error(`Slots API error for court ${court.id}: ${body.data?.message ?? 'unknown'}`)
    }
    return {
      id: `${venue.id}-${court.id}`,
      name: courtDisplayName(court.name),
      type: 'doubles' as const,
      slots: toTimeSlots(body.data?.slots ?? [], currentMinutes),
    }
  }))

  return perCourt.filter(c => c !== null)
}
