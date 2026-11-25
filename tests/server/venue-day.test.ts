import { describe, expect, it, vi } from 'vitest'
import { byDayTime, dayMinutes, hasSlotStarted, isSlotOver } from '../../server/utils/time'
import { runScraper } from '../../server/utils/scraper-all'
import type { VenueInfo } from '../../server/utils/venues'

const AFTERNOON = 14 * 60

describe('venue-day clock', () => {
  it('puts after-midnight times at the end of the day', () => {
    expect(dayMinutes('06:00')).toBe(360)
    expect(dayMinutes('00:30')).toBe(1470)
    expect(['00:30', '06:00', '23:30'].sort(byDayTime)).toEqual(['06:00', '23:30', '00:30'])
  })

  it('does not mark tonight\'s after-midnight slots as over during the day', () => {
    expect(isSlotOver('00:30', AFTERNOON)).toBe(false)
    expect(isSlotOver('13:00', AFTERNOON)).toBe(true)
  })

  it('knows a slot has started from its start, not its end', () => {
    expect(hasSlotStarted('13:30', AFTERNOON)).toBe(true)  // 13:30–14:00 still running, but too late to book
    expect(hasSlotStarted('14:00', AFTERNOON)).toBe(false)
    expect(hasSlotStarted('00:00', AFTERNOON)).toBe(false)
    expect(hasSlotStarted('06:00', -1)).toBe(false)
  })
})

describe('runScraper slot order', () => {
  it('delivers each court\'s slots in venue-day order, whatever order the scraper used', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info: VenueInfo = {
      id: 'test', name: 'T', address: 'A', city: 'Kaunas', bookingUrl: 'https://x', indoor: true, color: '#000000',
    }
    const lexical = ['00:00', '00:30', '22:30', '23:00', '23:30'].map(time => ({ time, available: true, price: 10 }))
    const venue = await runScraper(info, async () => [{ id: 'c', name: 'C', type: 'doubles', slots: lexical }], '2026-11-25')
    expect(venue.courts[0]!.slots.map(s => s.time)).toEqual(['22:30', '23:00', '23:30', '00:00', '00:30'])
  })
})
