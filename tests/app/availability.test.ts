import { describe, expect, it } from 'vitest'
import {
  buildAvailabilityView, courtKind, courtMatches, nearestCity, resolveSession, type ViewFilters,
} from '../../app/utils/availability'
import { court, venue } from './fixtures'

const ANY: ViewFilters = { city: null, duration: 60, type: null, indoor: null, fromTime: '' }
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
  const broken = venue('b', 'Kaunas', [], { error: 'Nepavyko gauti duomenų' })

  it('filters by city, keeps errored venues, drops venues with no session', () => {
    const view = buildAvailabilityView([kaunas, vilnius, full, broken], { ...ANY, city: 'Kaunas' }, NOT_TODAY)
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

  it('offers only not-yet-started times in the selected city for the start picker', () => {
    const view = buildAvailabilityView([kaunas, vilnius], { ...ANY, city: 'Kaunas' }, 18 * 60 + 40)
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

describe('nearestCity', () => {
  it('picks the closest city', () => {
    expect(nearestCity(54.69, 25.28)).toBe('Vilnius')
    expect(nearestCity(55.71, 21.15)).toBe('Klaipėda')
  })
})
