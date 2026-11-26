import { describe, expect, it } from 'vitest'
import { bookedAt, openingSlots, perHalfHour, startsWithin, toSlots } from '../../server/utils/day-grid'

describe('openingSlots', () => {
  it('lays out half hours from opening to closing, including to midnight', () => {
    expect(openingSlots('21:00', '23:00')).toEqual(['21:00', '21:30', '22:00', '22:30'])
    expect(openingSlots('23:00', '00:00')).toEqual(['23:00', '23:30'])
  })

  it('runs past midnight when the club closes after it', () => {
    expect(openingSlots('22:00', '01:30')).toEqual(['22:00', '22:30', '23:00', '23:30', '00:00', '00:30', '01:00'])
    expect(openingSlots('08:00', '02:00')).toHaveLength(36)
  })

  it('treats open = close as closed', () => {
    expect(openingSlots('10:00', '10:00')).toEqual([])
  })
})

describe('bookedAt', () => {
  const isBooked = bookedAt([{ start: '10:00', end: '11:00' }, { start: '23:30', end: '00:30' }])

  it('marks every half hour a booking overlaps', () => {
    expect(['09:30', '10:00', '10:30', '11:00'].map(isBooked)).toEqual([false, true, true, false])
  })

  it('handles bookings that run past midnight', () => {
    expect(['23:00', '23:30', '00:00', '00:30'].map(isBooked)).toEqual([false, true, true, false])
  })

  it('catches a booking that starts mid-slot', () => {
    expect(bookedAt([{ start: '10:15', end: '10:45' }])('10:00')).toBe(true)
  })

  it('handles a night booking across 04:00 at a club open all night', () => {
    const night = bookedAt([{ start: '03:00', end: '05:00' }])
    expect(['02:30', '03:00', '04:00', '04:30', '05:00'].map(night)).toEqual([false, true, true, true, false])
  })

  it('does not spill a booking that ends at midnight into the next slot', () => {
    expect(bookedAt([{ start: '23:00', end: '00:00' }])('00:00')).toBe(false)
  })
})

describe('startsWithin', () => {
  it('matches price segments that run past midnight', () => {
    const late = { start: '22:00', end: '02:00' }
    expect(['21:30', '22:00', '23:30', '00:30', '01:30', '02:00'].map(t => startsWithin(t, late)))
      .toEqual([false, true, true, true, true, false])
  })

  it('treats a segment ending "00:00" as running to midnight', () => {
    expect(startsWithin('23:30', { start: '21:00', end: '00:00' })).toBe(true)
    expect(startsWithin('00:00', { start: '21:00', end: '00:00' })).toBe(false)
  })
})

describe('toSlots', () => {
  const cells = [
    { time: '13:00', free: true, price: 10 },
    { time: '14:00', free: true, price: 12 },
    { time: '15:00', free: false, price: 12 },
    { time: '00:30', free: true, price: 8 },
  ]

  it('prices only available slots', () => {
    expect(toSlots(cells, -1)).toEqual([
      { time: '13:00', available: true, price: 10 },
      { time: '14:00', available: true, price: 12 },
      { time: '15:00', available: false, price: null },
      { time: '00:30', available: true, price: 8 },
    ])
  })

  it('never offers a slot that has already ended, but keeps tonight\'s after-midnight ones', () => {
    expect(toSlots(cells, 14 * 60 + 10).map(s => s.available)).toEqual([false, true, false, true])
  })
})

describe('perHalfHour', () => {
  it('halves an hourly price and passes unknown prices through', () => {
    expect(perHalfHour(30)).toBe(15)
    expect(perHalfHour(null)).toBeNull()
    expect(perHalfHour(undefined)).toBeNull()
  })
})
