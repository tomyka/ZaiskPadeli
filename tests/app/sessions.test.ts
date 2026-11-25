import { describe, expect, it } from 'vitest'
import type { Court, TimeSlot } from '../../server/utils/types'
import {
  byDayTime, courtSessionStarts, dayStrip, formatPrice, isDuration, ltPlural, sessionEnd, venueSessions,
} from '../../app/utils/sessions'

/** Builds a court from a pattern: one char per 30-min slot from `first`; '1' free, '0' booked. */
function court(id: string, pattern: string, first = '18:00', price: number | null = 10): Court {
  const [h, m] = first.split(':').map(Number) as [number, number]
  const slots: TimeSlot[] = pattern.split('').map((c, i) => {
    const min = (h * 60 + m + i * 30) % 1440
    const time = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    return { time, available: c === '1', price }
  })
  return { id, name: id, type: 'doubles', slots }
}

describe('courtSessionStarts', () => {
  it('offers starts only where enough consecutive slots are free', () => {
    // 18:00 18:30 19:00 19:30 20:00 20:30
    const c = court('a', '111011')
    expect(courtSessionStarts(c, 60).map(s => s.time)).toEqual(['18:00', '18:30', '20:00'])
    expect(courtSessionStarts(c, 90).map(s => s.time)).toEqual(['18:00'])
    expect(courtSessionStarts(c, 120)).toEqual([])
  })

  it('sums slot prices for the whole session', () => {
    expect(courtSessionStarts(court('a', '111', '18:00', 7), 90)).toEqual([{ time: '18:00', price: 21 }])
  })

  it('rounds fractional prices to cents', () => {
    expect(courtSessionStarts(court('a', '111', '18:00', 6.7), 90)[0]!.price).toBe(20.1)
  })

  it('returns a null price when any slot in the session is unpriced', () => {
    const c = court('a', '11')
    c.slots[1]!.price = null
    expect(courtSessionStarts(c, 60)).toEqual([{ time: '18:00', price: null }])
  })

  it('skips starts before the earliest allowed minute', () => {
    expect(courtSessionStarts(court('a', '1111'), 60, 18 * 60 + 15).map(s => s.time)).toEqual(['18:30', '19:00'])
  })

  it('does not join slots that are adjacent in the array but not in time', () => {
    const c = court('a', '11')
    c.slots[1]!.time = '19:30'
    expect(courtSessionStarts(c, 60)).toEqual([])
  })
})

describe('after-midnight slots', () => {
  // 23:00 23:30 00:00 00:30 — a venue open past midnight
  const late = court('late', '1111', '23:00')

  it('joins sessions across midnight', () => {
    expect(courtSessionStarts(late, 90).map(s => s.time)).toEqual(['23:00', '23:30'])
  })

  it('treats after-midnight starts as later than the evening, not earlier', () => {
    expect(courtSessionStarts(late, 30, 20 * 60).map(s => s.time)).toEqual(['23:00', '23:30', '00:00', '00:30'])
    expect(venueSessions([late], 30).starts.map(s => s.time)).toEqual(['23:00', '23:30', '00:00', '00:30'])
  })

  it('orders the day strip evening-first', () => {
    expect(dayStrip([late], -1).map(c => c.time)).toEqual(['23:00', '23:30', '00:00', '00:30'])
    expect([...['00:30', '06:00', '23:30']].sort(byDayTime)).toEqual(['06:00', '23:30', '00:30'])
  })
})

describe('venueSessions', () => {
  it('merges courts by start time, earliest first, with the cheapest price', () => {
    const a = court('a', '0011', '18:00', 10) // 19:00
    const b = court('b', '1100', '18:00', 8)  // 18:00
    const c = court('c', '0011', '18:00', 6)  // 19:00
    const v = venueSessions([a, b, c], 60)
    expect(v.starts.map(s => [s.time, s.courts.map(x => x.court.id), s.minPrice])).toEqual([
      ['18:00', ['b'], 16],
      ['19:00', ['a', 'c'], 12],
    ])
    expect(v.minPrice).toBe(12)
    expect(v.perCourt.map(p => p.starts.length)).toEqual([1, 1, 1])
  })

  it('has a null minimum price when nothing is priced', () => {
    expect(venueSessions([court('a', '11', '18:00', null)], 60).minPrice).toBeNull()
  })
})

describe('dayStrip', () => {
  it('marks a slot free when any court has it free, and past slots as past', () => {
    const a = court('a', '100', '18:00')
    const b = court('b', '001', '18:00')
    expect(dayStrip([a, b], -1).map(c => c.state)).toEqual(['free', 'busy', 'free'])
    expect(dayStrip([a, b], 18 * 60 + 40).map(c => c.state)).toEqual(['past', 'past', 'free'])
  })
})

describe('helpers', () => {
  it('sessionEnd wraps past midnight', () => {
    expect(sessionEnd('18:00', 90)).toBe('19:30')
    expect(sessionEnd('23:00', 60)).toBe('00:00')
  })

  it('formatPrice keeps whole euros short', () => {
    expect(formatPrice(42)).toBe('€42')
    expect(formatPrice(40.5)).toBe('€40.50')
  })

  it('isDuration accepts only offered durations', () => {
    expect(isDuration(90)).toBe(true)
    expect(isDuration(45)).toBe(false)
    expect(isDuration('90')).toBe(false)
  })

  it('ltPlural picks Lithuanian noun forms', () => {
    const f = (n: number) => ltPlural(n, 'kortas', 'kortai', 'kortų')
    expect([1, 2, 9, 10, 11, 15, 20, 21, 22, 111].map(f)).toEqual([
      'kortas', 'kortai', 'kortai', 'kortų', 'kortų', 'kortų', 'kortų', 'kortas', 'kortai', 'kortų',
    ])
  })
})
