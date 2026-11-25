/**
 * Lithuania's administrative regions, as used by the location filter:
 * a county (apskritis), optionally narrowed to one municipality (savivaldybė) in it.
 *
 * Pure data, imported by both server and client. Every venue records its real
 * municipality (venues.ts); the county is derived from it here.
 *
 * All 10 counties are listed (those without venues show as "coming soon"); only the
 * municipalities the app needs are. Add a municipality when a venue needs one.
 */

/** All counties, alphabetically, by the genitive stem their names share: "Kauno apskritis", "Kauno apskrities" */
export const COUNTIES = [
  'Alytaus', 'Kauno', 'Klaipėdos', 'Marijampolės', 'Panevėžio',
  'Šiaulių', 'Tauragės', 'Telšių', 'Utenos', 'Vilniaus',
] as const
export type County = typeof COUNTIES[number]

/**
 * Municipality → its county. City municipalities go by the city's name ("Kaunas"),
 * district municipalities by the short official form ("Prienų r.").
 * Order matters: within a county, list the city first — the filter's chips follow this order.
 * The five former city filters (Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys) must stay,
 * so saved { city } preferences still migrate (see parsePrefs).
 */
export const MUNICIPALITY_COUNTY = {
  'Vilnius': 'Vilniaus',
  'Kaunas': 'Kauno',
  'Prienų r.': 'Kauno',
  'Klaipėda': 'Klaipėdos',
  'Šiauliai': 'Šiaulių',
  'Plungės r.': 'Telšių',
  'Alytus': 'Alytaus',
  'Panevėžys': 'Panevėžio',
  'Panevėžio r.': 'Panevėžio',
} as const satisfies Record<string, County>
export type Municipality = keyof typeof MUNICIPALITY_COUNTY

export const MUNICIPALITIES = Object.keys(MUNICIPALITY_COUNTY) as Municipality[]

export function countyOf(m: Municipality): County {
  return MUNICIPALITY_COUNTY[m]
}

interface LatLng { lat: number; lng: number }

/** County seats */
const COUNTY_SEATS: Record<County, LatLng> = {
  'Alytaus':      { lat: 54.3963, lng: 24.0458 },
  'Kauno':        { lat: 54.8985, lng: 23.9036 },
  'Klaipėdos':    { lat: 55.7033, lng: 21.1443 },
  'Marijampolės': { lat: 54.5593, lng: 23.3541 },
  'Panevėžio':    { lat: 55.7348, lng: 24.3601 },
  'Šiaulių':      { lat: 55.9349, lng: 23.3137 },
  'Tauragės':     { lat: 55.2522, lng: 22.2897 },
  'Telšių':       { lat: 55.9814, lng: 22.2472 },
  'Utenos':       { lat: 55.4977, lng: 25.5992 },
  'Vilniaus':     { lat: 54.6872, lng: 25.2797 },
}

/**
 * Points that place a GPS position in a county: every seat, plus venue towns that lie
 * nearer another county's seat than their own (Prienai is closer to Alytus than to Kaunas).
 * Nearest-point is an approximation of county borders, good enough to preselect a filter.
 */
const COUNTY_REFERENCE_POINTS: { county: County; at: LatLng }[] = [
  ...(Object.entries(COUNTY_SEATS) as [County, LatLng][]).map(([county, at]) => ({ county, at })),
  { county: 'Kauno', at: { lat: 54.6333, lng: 23.9500 } }, // Prienai
]

/** A degree of longitude is ~0.57 as long as a degree of latitude at Lithuania's ~55°N */
const LNG_SCALE = Math.cos((55 * Math.PI) / 180)

/** The county a GPS position most likely lies in */
export function nearestCounty(lat: number, lng: number): County {
  let nearest = COUNTY_REFERENCE_POINTS[0]!.county
  let minDist = Infinity
  for (const { county, at } of COUNTY_REFERENCE_POINTS) {
    const dist = Math.hypot(lat - at.lat, (lng - at.lng) * LNG_SCALE)
    if (dist < minDist) { minDist = dist; nearest = county }
  }
  return nearest
}
