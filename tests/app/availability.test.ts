import { describe, expect, it } from 'vitest'
import {
  buildAvailabilityView, chipPrice, courtKind, courtMatches, pricesByKind, resolveSession,
  venuePricesByKind, type ViewFilters,
} from '../../app/utils/availability'
import { court, venue } from './fixtures'
import { venueSessions } from '../../app/utils/sessions'
import { nearestCounty } from '../../server/utils/regions'

const ANY: ViewFilters = { county: null, municipality: null, duration: 60, type: null, indoor: null, fromTime: '' }
const NOT_TODAY = -1

describe('courtKind / courtMatches', () => {
  it('treats an unknown type as doubles for display and filtering alike', () => {
    const unknown = court('u', '1', '18:00', 10, { type: 'unknown' })
    expect(courtKind(unknown)).toBe('doubles')
    expect(courtMatches(unknown, { type: 'doubles', indoor: null })).toBe(true)
    expect(courtMatches(unknown, { type: 'singles', indoor: null })).toBe(false)
  })

  it('lets a court with unknown indoor flag match either indoor filter', () => {
    const c = court('c', '1')
    expect(courtMatches(c, { type: null, indoor: true })).toBe(true)
    expect(courtMatches(c, { type: null, indoor: false })).toBe(true)
    expect(courtMatches({ ...c, indoor: false }, { type: null, indoor: true })).toBe(false)
  })
})

describe('buildAvailabilityView', () => {
  const kaunas = venue('k', 'Kaunas', [court('k1', '1100'), court('k2', '0011', '18:00', 10, { type: 'singles' })])
  const vilnius = venue('v', 'Vilnius', [court('v1', '1100')])
  const full = venue('f', 'Kaunas', [court('f1', '0000')])
  const broken = venue('b', 'Kaunas', [], { status: 'failed' })

  it('filters by county, keeps errored venues, drops venues with no session', () => {
    const view = buildAvailabilityView([kaunas, vilnius, full, broken], { ...ANY, county: 'Kauno' }, NOT_TODAY)
    expect(view.venues.map(v => v.venue.id)).toEqual(['k', 'b'])
    expect(view.bookableCount).toBe(1)
  })

  it('applies court filters before finding sessions', () => {
    const view = buildAvailabilityView([kaunas], { ...ANY, type: 'singles' }, NOT_TODAY)
    expect(view.venues[0]!.courts.map(c => c.id)).toEqual(['k2'])
    expect(view.venues[0]!.sessions.starts.map(s => s.time)).toEqual(['19:00'])
  })

  it('starts no earlier than the later of now and the chosen start time', () => {
    const v = venue('x', 'Kaunas', [court('x1', '111111')]) // 18:00–21:00 free
    const starts = (f: Partial<ViewFilters>, now: number) =>
      buildAvailabilityView([v], { ...ANY, ...f }, now).venues[0]!.sessions.starts.map(s => s.time)
    expect(starts({ fromTime: '19:00' }, NOT_TODAY)).toEqual(['19:00', '19:30', '20:00'])
    expect(starts({ fromTime: '18:00' }, 19 * 60 + 10)).toEqual(['19:30', '20:00'])
  })

  it('lists every municipality of a county, or only the one it is narrowed to', () => {
    const prienai = venue('p', 'Prienų r.', [court('p1', '1100')])
    const ids = (f: Partial<ViewFilters>) =>
      buildAvailabilityView([kaunas, prienai, vilnius], { ...ANY, ...f }, NOT_TODAY).venues.map(v => v.venue.id)
    expect(ids({ county: 'Kauno' })).toEqual(['k', 'p'])
    expect(ids({ county: 'Kauno', municipality: 'Prienų r.' })).toEqual(['p'])
    expect(ids({ county: 'Kauno', municipality: 'Kaunas' })).toEqual(['k'])
    expect(ids({})).toEqual(['k', 'p', 'v'])
  })

  it('offers only not-yet-started times in the selected region for the start picker', () => {
    const view = buildAvailabilityView([kaunas, vilnius], { ...ANY, county: 'Kauno' }, 18 * 60 + 40)
    expect(view.startTimeOptions).toEqual(['19:00', '19:30'])
  })

  it('offers start picker times only from courts that pass the filters', () => {
    const view = buildAvailabilityView([kaunas], { ...ANY, type: 'singles' }, NOT_TODAY)
    expect(view.startTimeOptions).toEqual(['18:00', '18:30', '19:00', '19:30'])
    const mixed = venue('m', 'Kaunas', [court('m1', '11', '18:00'), court('m2', '11', '20:00', 10, { type: 'singles' })])
    expect(buildAvailabilityView([mixed], { ...ANY, type: 'singles' }, NOT_TODAY).startTimeOptions).toEqual(['20:00', '20:30'])
  })

  it('orders start picker times evening-first across midnight', () => {
    const late = venue('l', 'Kaunas', [court('l1', '1111', '23:00')])
    expect(buildAvailabilityView([late], ANY, NOT_TODAY).startTimeOptions).toEqual(['23:00', '23:30', '00:00', '00:30'])
  })
})

describe('resolveSession', () => {
  const v = venue('x', 'Kaunas', [court('x1', '111111'), court('x2', '110000')])
  const view = buildAvailabilityView([v], ANY, NOT_TODAY)

  it('lists the free courts for that start and the other starts', () => {
    const selected = resolveSession(view, 'x', '18:00')!
    expect(selected.start.courts.map(c => c.court.id)).toEqual(['x1', 'x2'])
    expect(selected.others.map(s => s.time)).toEqual(['18:30', '19:00', '19:30', '20:00'])
  })

  it('returns null when the session no longer exists', () => {
    expect(resolveSession(view, 'x', '20:30')).toBeNull()
    expect(resolveSession(view, 'nope', '18:00')).toBeNull()
  })
})

describe('nearestCounty (regions.ts)', () => {
  it('picks the county with the closest seat', () => {
    expect(nearestCounty(54.69, 25.28)).toBe('Vilniaus')
    expect(nearestCounty(55.71, 21.15)).toBe('Klaipėdos')
    expect(nearestCounty(54.63, 23.95)).toBe('Kauno') // Prienai
    expect(nearestCounty(55.50, 25.60)).toBe('Utenos')
    expect(nearestCounty(54.40, 24.05)).toBe('Alytaus')
  })
})

describe('prices by court type', () => {
  const doubles = court('d', '11', '18:00', 20)
  const single = court('s', '11', '18:00', 12, { type: 'singles' })
  const unknown = court('u', '11', '18:00', 22, { type: 'unknown' })
  const start = (cs: typeof doubles[]) => venueSessions(cs, 60).starts[0]!

  it('reports the cheapest price per type, unknown counting as doubles', () => {
    expect(pricesByKind(start([doubles, single, unknown]).courts)).toEqual({ doubles: 40, singles: 24 })
  })

  it('chips show the doubles price when a doubles court is free, even if singles is cheaper', () => {
    expect(chipPrice(start([doubles, single]))).toEqual({ price: 40, singlesOnly: false })
  })

  it('chips mark starts where only singles courts are free', () => {
    expect(chipPrice(start([single]))).toEqual({ price: 24, singlesOnly: true })
  })

  it('summarises a venue across all its starts', () => {
    const late = court('d2', '0011', '18:00', 15)
    expect(venuePricesByKind(venueSessions([single, late], 60).starts)).toEqual({ doubles: 30, singles: 24 })
  })
})
