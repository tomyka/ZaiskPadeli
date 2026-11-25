import { describe, expect, it } from 'vitest'
import { carryOverFailedVenues } from '../../server/utils/refresh'
import { VENUE_ERROR } from '../../server/utils/scraper-all'
import type { Court, Venue } from '../../server/utils/types'

const NOW = Date.parse('2026-11-25T12:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

const court: Court = { id: 'x-1', name: 'Kortas 1', type: 'doubles', slots: [{ time: '10:00', available: true, price: 20 }] }

function venue(id: string, over: Partial<Venue> = {}): Venue {
  return { id, name: id, address: '', city: 'Kaunas', bookingUrl: '', courts: [court], lastUpdated: minutesAgo(0), ...over }
}
const failed = (id: string) => venue(id, { courts: [], error: VENUE_ERROR.failed })

describe('carryOverFailedVenues', () => {
  it('keeps the last good courts and their timestamp for a failed venue', () => {
    const prev = venue('a', { lastUpdated: minutesAgo(20) })
    const { venues, carried } = carryOverFailedVenues([failed('a'), venue('b')], [prev], NOW)
    expect(carried).toEqual(['a'])
    expect(venues[0]).toEqual({ ...failed('a'), error: undefined, courts: prev.courts, lastUpdated: prev.lastUpdated, carriedOver: true })
    expect(venues[0]).not.toHaveProperty('error')
    expect(venues[1]).toEqual(venue('b'))
  })

  it('carries over every venue when the whole scrape fails', () => {
    const { venues, carried } = carryOverFailedVenues([failed('a'), failed('b')], [venue('a'), venue('b')], NOW)
    expect(carried).toEqual(['a', 'b'])
    expect(venues.every(v => !v.error && v.courts.length)).toBe(true)
  })

  it('lets data expire by the venue\'s own age, so carried data is not stretched', () => {
    const { venues, carried } = carryOverFailedVenues([failed('a')], [venue('a', { lastUpdated: minutesAgo(61) })], NOW)
    expect(carried).toEqual([])
    expect(venues[0]!.error).toBe(VENUE_ERROR.failed)
  })

  it('does not carry over previous data with a missing or malformed timestamp', () => {
    const { carried } = carryOverFailedVenues([failed('a')], [venue('a', { lastUpdated: '' })], NOW)
    expect(carried).toEqual([])
  })

  it('does not replace an empty day, a previous error, or a venue with no previous data', () => {
    const empty = venue('a', { courts: [], error: VENUE_ERROR.empty })
    const prevFailed = failed('b')
    const { venues, carried } = carryOverFailedVenues(
      [empty, failed('b'), failed('c')],
      [venue('a'), prevFailed],
      NOW,
    )
    expect(carried).toEqual([])
    expect(venues.map(v => v.error)).toEqual([VENUE_ERROR.empty, VENUE_ERROR.failed, VENUE_ERROR.failed])
  })

  it('passes fresh data through when there is no previous entry', () => {
    const fresh = [venue('a'), failed('b')]
    expect(carryOverFailedVenues(fresh, undefined, NOW)).toEqual({ venues: fresh, carried: [] })
  })
})
