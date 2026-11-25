// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import { CITY_COORDS, type City, type Court, type CourtKind, type Venue } from '../../server/utils/types'
import { byDayTime, dayMinutes, hasSlotStarted } from '../../server/utils/time'
import { dayStrip, venueSessions, type SessionStart, type StripCell, type VenueSessions } from './sessions'

/**
 * What the availability page shows for a set of filters: which venues, which
 * courts, which bookable sessions, and the session sheet. Pure, so the page
 * only binds the result.
 */

export type { CourtKind }

/** A court's type for display and filtering; an unknown type counts as doubles, the common case. */
export function courtKind(court: Court): CourtKind {
  return court.type === 'singles' ? 'singles' : 'doubles'
}

export interface ViewFilters {
  city: City | null
  duration: number
  type: CourtKind | null
  indoor: boolean | null
  /** "HH:MM" earliest session start, or '' for any */
  fromTime: string
}

/** Courts whose indoor flag is unknown match either indoor filter */
export function courtMatches(court: Court, f: Pick<ViewFilters, 'type' | 'indoor'>): boolean {
  if (f.type && courtKind(court) !== f.type) return false
  if (f.indoor !== null && court.indoor !== undefined && court.indoor !== f.indoor) return false
  return true
}

export interface VenueView {
  venue: Venue
  /** Courts passing the type/indoor filters */
  courts: Court[]
  sessions: VenueSessions
  strip: StripCell[]
}

export interface AvailabilityView {
  /** Venues with at least one session, plus venues that failed to load (shown with their error) */
  venues: VenueView[]
  bookableCount: number
  /** Choices for the "nuo" picker: every not-yet-started slot time on matching courts in the selected city */
  startTimeOptions: string[]
}

/** `currentMinutes` comes from `currentMinutesFor(date)`: -1 when the date isn't today. */
export function buildAvailabilityView(venues: Venue[], f: ViewFilters, currentMinutes: number): AvailabilityView {
  const inCity = venues.filter(v => !f.city || v.city === f.city)
  const earliest = Math.max(currentMinutes, f.fromTime ? dayMinutes(f.fromTime) : 0)

  const all: VenueView[] = inCity.map(venue => {
    const courts = venue.courts.filter(c => courtMatches(c, f))
    return {
      venue,
      courts,
      sessions: venueSessions(courts, f.duration, earliest),
      strip: dayStrip(courts, currentMinutes),
    }
  })
  const views = all.filter(v => v.sessions.starts.length > 0 || v.venue.error)

  const times = new Set<string>()
  for (const { courts } of all)
    for (const court of courts)
      for (const slot of court.slots)
        if (!hasSlotStarted(slot.time, currentMinutes)) times.add(slot.time)

  return {
    venues: views,
    bookableCount: views.filter(v => v.sessions.starts.length > 0).length,
    startTimeOptions: [...times].sort(byDayTime),
  }
}

export interface SessionSheet {
  venue: Venue
  start: SessionStart
  /** A few other start times at the same venue to jump to */
  others: SessionStart[]
}

const OTHER_STARTS = 8

/** The sheet for one venue + start time, or null once that session is gone (e.g. after a refresh). */
export function resolveSession(view: AvailabilityView, venueId: string, time: string): SessionSheet | null {
  const v = view.venues.find(x => x.venue.id === venueId)
  const start = v?.sessions.starts.find(s => s.time === time)
  if (!v || !start) return null
  return {
    venue: v.venue,
    start,
    others: v.sessions.starts.filter(s => s.time !== time).slice(0, OTHER_STARTS),
  }
}

/** Closest city with coordinates; plain lat/lng distance is fine at Lithuania's scale. */
export function nearestCity(lat: number, lng: number): City {
  let nearest: City = 'Kaunas'
  let minDist = Infinity
  for (const [city, c] of Object.entries(CITY_COORDS) as [City, { lat: number; lng: number }][]) {
    const dist = Math.hypot(lat - c.lat, lng - c.lng)
    if (dist < minDist) { minDist = dist; nearest = city }
  }
  return nearest
}
