import type { Court } from './types'
import { bookedAt, openingSlots, toSlots } from './day-grid'
import { courtTypeFromName } from './parse'
import { currentMinutesFor, dayOfWeek, toEndMinutes, toMinutes } from './time'
import { BROWSER_UA } from './user-agent'

/**
 * Playball platform (playball.lt), public API used by its booking page:
 *   GET /api/v1/clubs/by-slug/{slug}                     → id, working_hours per weekday
 *   GET /api/v1/courts?club_id={id}&sport_type=padel     → courts (name, court_type indoor/outdoor)
 *   GET /api/v1/courts/booked-slots/{id}?booking_date=…  → booked ranges per court
 *   GET /api/v1/clubs/{id}/price-policies?date=…         → price segments by weekday and time
 *
 * Times carry a "Z" but are local clock times; the site strips it too (normalizeTimeOfDay).
 * Weekdays: 1 = Monday … 7 = Sunday. Segment prices are per half hour: 4Padel's 11 / 18
 * match the €22–36 per hour of nearby clubs, while per hour they would be half of everyone else's.
 */

const API = 'https://playball.lt/api/v1'

export interface PlayballClub {
  id: number
  working_hours: { day_of_week: number; is_active: boolean; start_time: string; end_time: string }[]
}
export interface PlayballCourt { id: number; name: string; court_type?: string; is_active?: boolean }
export interface PlayballBooked { court_id: number; bookings: { start_time: string; end_time: string }[] }
export interface PlayballPolicy {
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  price_segments: { start_time: string; end_time: string; price: number; days_of_week: number[] }[]
  courts: { id: number }[]
}
export interface PlayballDay {
  club: PlayballClub
  courts: PlayballCourt[]
  booked: PlayballBooked[]
  policies: PlayballPolicy[]
}

/** "08:00:00Z" → "08:00" */
const clock = (t: string) => t.replace(/[Z+].*$/, '').slice(0, 5)

/** "2026-11-27" or "2026-11-27T00:00:00Z" → "2026-11-27" */
const isoDate = (d: string) => d.slice(0, 10)

/** 1 = Monday … 7 = Sunday */
const isoWeekday = (date: string) => dayOfWeek(date) || 7

/** Pure: one day's API data → Court[] over the club's working hours */
export function buildPlayballCourts(day: PlayballDay, date: string, idPrefix: string, currentMinutes = -1): Court[] {
  const weekday = isoWeekday(date)
  const hours = day.club.working_hours.find(h => h.day_of_week === weekday && h.is_active)
  if (!hours) return []
  const times = openingSlots(clock(hours.start_time), clock(hours.end_time))

  const policies = day.policies.filter(p => p.is_active
    && (!p.start_date || isoDate(p.start_date) <= date)
    && (!p.end_date || date <= isoDate(p.end_date)))

  const priceFor = (courtId: number, time: string): number | null => {
    const slot = toMinutes(time)
    for (const p of policies) {
      if (!p.courts.some(c => c.id === courtId)) continue
      for (const s of p.price_segments) {
        if (!s.days_of_week.includes(weekday)) continue
        if (slot >= toMinutes(clock(s.start_time)) && slot < toEndMinutes(clock(s.end_time))) return s.price
      }
    }
    return null
  }

  return day.courts.filter(c => c.is_active !== false).map((c) => {
    const ranges = day.booked.find(b => b.court_id === c.id)?.bookings ?? []
    const isBooked = bookedAt(ranges.map(r => ({ start: clock(r.start_time), end: clock(r.end_time) })))
    return {
      id: `${idPrefix}-${c.id}`,
      name: c.name,
      type: courtTypeFromName(c.name),
      // Per court: a club can mix indoor and outdoor courts
      ...(c.court_type === 'indoor' ? { indoor: true } : c.court_type === 'outdoor' ? { indoor: false } : {}),
      slots: toSlots(times.map(time => ({ time, free: !isBooked(time), price: priceFor(c.id, time) })), currentMinutes),
    }
  })
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** List endpoints answer a bare array or a page envelope ({ items } / { data }) */
const items = <T>(body: unknown): T[] =>
  Array.isArray(body) ? body as T[] : ((body as { items?: T[]; data?: T[] })?.items ?? (body as { data?: T[] })?.data ?? [])

/** Build a scraper for one Playball club, by its URL slug (playball.lt/lt/arenas/{slug}/book) */
export function playballScraper(config: { slug: string }) {
  return async (date: string, venue: { id: string }): Promise<Court[]> => {
    const club = await getJson<PlayballClub>(`/clubs/by-slug/${config.slug}`)
    const [courts, booked, policies] = await Promise.all([
      getJson<unknown>(`/courts?club_id=${club.id}&sport_type=padel&size=50`).then(items<PlayballCourt>),
      getJson<unknown>(`/courts/booked-slots/${club.id}?booking_date=${date}`).then(items<PlayballBooked>),
      getJson<unknown>(`/clubs/${club.id}/price-policies?date=${date}`).then(items<PlayballPolicy>),
    ])
    return buildPlayballCourts({ club, courts, booked, policies }, date, venue.id, currentMinutesFor(date))
  }
}
