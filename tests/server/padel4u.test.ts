import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  courtDisplayName, parsePadel4uConfig, scrapePadel4u, toTimeSlots, type Padel4uSlot,
} from '../../server/utils/scraper-padel4u'

const PAGE = readFileSync(fileURLToPath(new URL('../fixtures/padel4u-page.html', import.meta.url)), 'utf8')

// Shape taken from a real padel_get_available_slots response (2026-11-26, court 17)
const slot = (start: string, end: string, price: number, available = true, reason = ''): Padel4uSlot =>
  ({ start_time: start, end_time: end, price, available, reason })
const DAY: Padel4uSlot[] = [
  slot('05:00', '05:30', 13),
  slot('05:30', '06:00', 13, false, 'booked'),
  slot('20:00', '20:30', 19, false, 'tournament'),
  slot('23:30', '00:00', 10),
  slot('00:00', '00:30', 10),
  slot('02:00', '02:30', 10),
]

describe('parsePadel4uConfig', () => {
  it('reads the nonce and courts from the booking page', () => {
    expect(parsePadel4uConfig(PAGE)).toEqual({
      nonce: '971eaa11de',
      courts: [
        { id: 17, name: '1 kortas' }, { id: 59, name: '2 Kortas' },
        { id: 60, name: '3 Kortas' }, { id: 61, name: '4 Metalurga' },
      ],
    })
  })

  it('fails loudly when the page layout changes', () => {
    expect(() => parsePadel4uConfig('<html></html>')).toThrow(/config not found/)
  })
})

describe('slot mapping', () => {
  it('keeps after-midnight slots, at the end of the venue day, and prices only available slots', () => {
    expect(toTimeSlots(DAY, -1)).toEqual([
      { time: '05:00', available: true, price: 13 },
      { time: '05:30', available: false, price: null },
      { time: '20:00', available: false, price: null },
      { time: '23:30', available: true, price: 10 },
      { time: '00:00', available: true, price: 10 },
      { time: '02:00', available: true, price: 10 },
    ])
  })

  it('marks finished slots unavailable today, but not tonight\'s after-midnight ones', () => {
    expect(toTimeSlots(DAY, 6 * 60).map(s => s.available)).toEqual([false, false, false, true, true, true])
  })

  it('normalises court names', () => {
    expect(courtDisplayName('1 kortas')).toBe('Kortas 1')
    expect(courtDisplayName('2 Kortas')).toBe('Kortas 2')
    expect(courtDisplayName('4 Metalurga')).toBe('Kortas 4 Metalurga')
    expect(courtDisplayName('Centrinis')).toBe('Centrinis')
  })
})

describe('scrapePadel4u', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  function stubFetch(slotsResponse: (courtId: string) => unknown) {
    const posts: URLSearchParams[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (!init?.method) return new Response(PAGE)
      const body = new URLSearchParams(init.body as string)
      posts.push(body)
      return Response.json(slotsResponse(body.get('court_id')!))
    }))
    return posts
  }

  it('queries every court with the page nonce and builds courts', async () => {
    const posts = stubFetch(() => ({ success: true, data: { slots: DAY } }))
    const courts = await scrapePadel4u('2099-01-01', { id: 'padel4u' })

    expect(posts.map(p => [p.get('action'), p.get('nonce'), p.get('court_id'), p.get('date')])).toEqual([
      ['padel_get_available_slots', '971eaa11de', '17', '2099-01-01'],
      ['padel_get_available_slots', '971eaa11de', '59', '2099-01-01'],
      ['padel_get_available_slots', '971eaa11de', '60', '2099-01-01'],
      ['padel_get_available_slots', '971eaa11de', '61', '2099-01-01'],
    ])
    expect(courts.map(c => [c.id, c.name])).toEqual([
      ['padel4u-17', 'Kortas 1'], ['padel4u-59', 'Kortas 2'], ['padel4u-60', 'Kortas 3'], ['padel4u-61', 'Kortas 4 Metalurga'],
    ])
    expect(courts[0]!.slots).toHaveLength(6)
  })

  it('returns no courts (not an error) beyond the booking window', async () => {
    stubFetch(() => ({ success: false, data: { message: 'Rezervuoti galima tik iki 2026-12-25.' } }))
    await expect(scrapePadel4u('2099-01-01', { id: 'padel4u' })).resolves.toEqual([])
  })

  it('throws on other API failures (e.g. expired nonce)', async () => {
    stubFetch(() => ({ success: false, data: { message: 'Invalid nonce' } }))
    await expect(scrapePadel4u('2099-01-01', { id: 'padel4u' })).rejects.toThrow(/Invalid nonce/)
  })
})
