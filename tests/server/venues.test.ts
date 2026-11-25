import { describe, expect, it, vi } from 'vitest'
import { CITIES, type Court } from '../../server/utils/types'
import { ACTIVE_CITIES, VENUES, venueInfo, type VenueInfo } from '../../server/utils/venues'
import { runScraper, SCRAPERS, VENUE_ERROR } from '../../server/utils/scraper-all'

describe('venue registry', () => {
  it('has unique ids', () => {
    const ids = VENUES.map(v => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses known cities, hex colours and https booking links', () => {
    for (const v of VENUES) {
      expect(CITIES).toContain(v.city)
      expect(v.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(v.bookingUrl).toMatch(/^https:\/\//)
    }
  })

  it('binds exactly one scraper per venue', () => {
    expect(Object.keys(SCRAPERS).sort()).toEqual(VENUES.map(v => v.id).sort())
  })

  it('derives active cities from venues', () => {
    expect(ACTIVE_CITIES.has('Kaunas')).toBe(true)
    expect(ACTIVE_CITIES.has('Šiauliai')).toBe(false)
  })

  it('looks venues up by id', () => {
    expect(venueInfo('padelhub')?.name).toBe('Balcia Padel Hub')
    expect(venueInfo('nope')).toBeUndefined()
  })
})

describe('runScraper', () => {
  const info: VenueInfo = {
    id: 'test', name: 'Test', address: 'A', city: 'Kaunas', bookingUrl: 'https://x', indoor: true, color: '#000000',
  }
  const court = (over: Partial<Court> = {}): Court =>
    ({ id: 'c', name: 'C', type: 'doubles', slots: [{ time: '10:00', available: true, price: 10 }], ...over })

  it('wraps courts with registry metadata and applies the indoor default', async () => {
    const venue = await runScraper(info, async () => [court(), court({ id: 'out', indoor: false })], '2026-11-25')
    expect(venue).toMatchObject({ id: 'test', name: 'Test', city: 'Kaunas', bookingUrl: 'https://x' })
    expect(venue.error).toBeUndefined()
    expect(venue.courts.map(c => c.indoor)).toEqual([true, false])
  })

  it('passes the venue info to the scraper', async () => {
    const scrape = vi.fn(async () => [court()])
    await runScraper(info, scrape, '2026-11-25')
    expect(scrape).toHaveBeenCalledWith('2026-11-25', info)
  })

  it('turns a thrown error into a user-facing error, without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const venue = await runScraper(info, async () => { throw new Error('boom') }, '2026-11-25')
    expect(venue.error).toBe(VENUE_ERROR.failed)
    expect(venue.courts).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[test]'), 'boom')
    warn.mockRestore()
  })

  it('flags an empty result', async () => {
    const venue = await runScraper(info, async () => [], '2026-11-25')
    expect(venue.error).toBe(VENUE_ERROR.empty)
  })

  it('gives up on a hanging scraper after the deadline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const venue = await runScraper(info, () => new Promise(() => {}), '2026-11-25', 20)
    expect(venue.error).toBe(VENUE_ERROR.failed)
    warn.mockRestore()
  })
})
