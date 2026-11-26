// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import type { Court, CourtKind, Venue } from '../../server/utils/types'
import { isIn, type Location } from './location'
import { byDayTime, dayMinutes, hasSlotStarted } from '../../server/utils/time'
import { dayStrip, venueSessions, type SessionStart, type StripCell, type VenueSessions } from './sessions'
import { venueProblem } from './venue-status'

/**
 * What the availability page shows for a set of filters: which venues, which
 * courts, which bookable sessions, and the selected session. Pure, so the page
 * only binds the result.
 */

/** A court's type for display and filtering; an unknown type counts as doubles, the common case. */
export function courtKind(court: Court): CourtKind {
  return court.type === 'singles' ? 'singles' : 'doubles'
}

export interface ViewFilters {
  location: Location
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
  /** Venues in the location with matching courts but no session for these filters: covered, just full */
  full: Venue[]
  bookableCount: number
  /** Choices for the "nuo" picker: every not-yet-started slot time on matching courts in the location,
   *  plus the chosen time even when this day doesn't offer it (so the picker never goes blank) */
  startTimeOptions: string[]
  /** Listed venues span several municipalities, so cards should name theirs */
  showMunicipality: boolean
}

/** `currentMinutes` comes from `currentMinutesFor(date)`: -1 when the date isn't today. */
export function buildAvailabilityView(venues: Venue[], f: ViewFilters, currentMinutes: number): AvailabilityView {
  const inLocation = venues.filter(v => isIn(f.location, v.municipality))
  const earliest = Math.max(currentMinutes, f.fromTime ? dayMinutes(f.fromTime) : 0)

  const all: VenueView[] = inLocation.map(venue => {
    const courts = venue.courts.filter(c => courtMatches(c, f))
    return {
      venue,
      courts,
      sessions: venueSessions(courts, f.duration, earliest),
      strip: dayStrip(courts, currentMinutes),
    }
  })
  const views = all.filter(v => v.sessions.starts.length > 0 || venueProblem(v.venue))

  const times = new Set<string>()
  for (const { courts } of all)
    for (const court of courts)
      for (const slot of court.slots)
        if (!hasSlotStarted(slot.time, currentMinutes)) times.add(slot.time)
  if (f.fromTime) times.add(f.fromTime)

  return {
    venues: views,
    full: all.filter(v => v.courts.length > 0 && v.sessions.starts.length === 0 && !venueProblem(v.venue)).map(v => v.venue),
    bookableCount: views.filter(v => v.sessions.starts.length > 0).length,
    startTimeOptions: [...times].sort(byDayTime),
    showMunicipality: new Set(views.map(v => v.venue.municipality)).size > 1,
  }
}

export interface SelectedSession {
  venue: Venue
  start: SessionStart
  /** Other start times at the same venue to jump to (generous, so a rare 2v2 slot is never cut off) */
  others: SessionStart[]
}

const OTHER_STARTS = 24

/** The selected session for one venue + start time, or null once that session is gone (e.g. after a refresh). */
export function resolveSession(view: AvailabilityView, venueId: string, time: string): SelectedSession | null {
  const v = view.venues.find(x => x.venue.id === venueId)
  const start = v?.sessions.starts.find(s => s.time === time)
  if (!v || !start) return null
  return {
    venue: v.venue,
    start,
    others: v.sessions.starts.filter(s => s.time !== time).slice(0, OTHER_STARTS),
  }
}

// ── Prices by court type ──
// Singles (1v1) courts are usually much cheaper, so a bare "from" price would
// quote a singles court to people looking for doubles. Prices are therefore
// reported per court type, and doubles is what a plain price means.

export interface KindPrices {
  doubles: number | null
  singles: number | null
}

/** Cheapest price per court type among the given court sessions */
export function pricesByKind(courts: { court: Court; price: number | null }[]): KindPrices {
  const out: KindPrices = { doubles: null, singles: null }
  for (const { court, price } of courts) {
    if (price === null) continue
    const k = courtKind(court)
    out[k] = out[k] === null ? price : Math.min(out[k]!, price)
  }
  return out
}

/**
 * What a time chip shows: the doubles price when a doubles court is free at
 * that start, otherwise the singles price marked as singles-only.
 */
export function chipPrice(start: SessionStart): { price: number | null; singlesOnly: boolean } {
  const singlesOnly = start.courts.every(c => courtKind(c.court) === 'singles')
  const p = pricesByKind(start.courts)
  return { price: singlesOnly ? p.singles : p.doubles, singlesOnly }
}

/** Cheapest price per court type across all of a venue's session starts */
export function venuePricesByKind(starts: SessionStart[]): KindPrices {
  return pricesByKind(starts.flatMap(s => s.courts))
}
