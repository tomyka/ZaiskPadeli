// Relative imports (not ~~/) so vitest can load this file without Nuxt's aliases
import { COUNTIES, MUNICIPALITIES, countyOf, nearestCounty, type County, type Municipality } from '../../server/utils/regions'
import { ACTIVE_COUNTIES, ACTIVE_MUNICIPALITIES } from '../../server/utils/venues'

/**
 * Where the visitor is looking: everywhere, a county, or one municipality in a county.
 *
 * Invariant: a municipality, when set, lies in the county. Every Location this module
 * returns satisfies it, so callers build Locations only through it: `toLocation` for
 * untrusted input (the prefs cookie), the moves below for the visitor's actions.
 */
export interface Location {
  readonly county: County | null
  readonly municipality: Municipality | null
}

export const EVERYWHERE: Location = { county: null, municipality: null }

/** Any pair → a valid Location; a municipality outside the county (or without one) is dropped */
export function toLocation(county: County | null, municipality: Municipality | null): Location {
  return { county, municipality: county && municipality && countyOf(municipality) === county ? municipality : null }
}

// ── Moves ────────────────────────────────────────────────────────────────────

/** Pick a county (null = everywhere); re-picking the current county keeps its municipality */
export function chooseCounty(loc: Location, county: County | null): Location {
  return county === loc.county ? loc : { county, municipality: null }
}

/** Narrow to a municipality (its county follows), or null for the whole current county */
export function chooseMunicipality(loc: Location, municipality: Municipality | null): Location {
  return municipality ? { county: countyOf(municipality), municipality } : { county: loc.county, municipality: null }
}

/** Move to the county a GPS position is in, keeping the municipality if the county doesn't change */
export function locateAt(loc: Location, lat: number, lng: number): Location {
  return chooseCounty(loc, nearestCounty(lat, lng))
}

// ── Reading a Location ───────────────────────────────────────────────────────

/** Is a venue in this municipality shown for the Location? */
export function isIn(loc: Location, municipality: Municipality): boolean {
  if (loc.municipality) return municipality === loc.municipality
  return !loc.county || countyOf(municipality) === loc.county
}

/** The county picker's options: everywhere, then every county; "greitai" marks counties without venues yet */
export const COUNTY_OPTIONS: { value: County | null; label: string; hint?: string }[] = [
  { value: null, label: 'Visa Lietuva' },
  ...COUNTIES.map(county => ({
    value: county,
    label: `${county} apskr.`,
    ...(ACTIVE_COUNTIES.has(county) ? {} : { hint: 'greitai' }),
  })),
]

export interface LocationChoices {
  /** Municipalities to narrow the county to, city first; empty when there is no choice to make */
  municipalities: Municipality[]
  /** Set when the county has no venues at all: say so instead of suggesting other filters */
  noVenuesText: string | null
}

export function locationChoices(loc: Location): LocationChoices {
  if (!loc.county) return { municipalities: [], noVenuesText: null }
  const county = loc.county
  const inCounty = MUNICIPALITIES.filter(m => countyOf(m) === county && ACTIVE_MUNICIPALITIES.has(m))
  return {
    municipalities: inCounty.length > 1 ? inCounty : [],
    noVenuesText: ACTIVE_COUNTIES.has(county) ? null : `${county} apskrities kortų duomenų kol kas neturime.`,
  }
}
