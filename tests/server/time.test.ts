import { describe, expect, it } from 'vitest'
import {
  addDays, currentMinutesFor, dayOfWeek, fromMinutes, isSlotOver,
  isValidIsoDate, nextDatesLT, nowLTMinutes, pastDatesLT, toEndMinutes, toMinutes, todayLT,
} from '../../server/utils/time'

// 2026-03-28 22:30 UTC = 2026-03-29 00:30 in Vilnius (UTC+2, DST starts later that night)
const LATE_UTC = new Date('2026-03-28T22:30:00Z')
// 2026-07-01 09:15 UTC = 12:15 in Vilnius (UTC+3, summer)
const SUMMER = new Date('2026-07-01T09:15:00Z')

describe('todayLT / nowLTMinutes', () => {
  it('uses Vilnius date, not UTC date, near midnight', () => {
    expect(todayLT(LATE_UTC)).toBe('2026-03-29')
    expect(nowLTMinutes(LATE_UTC)).toBe(30)
  })

  it('applies summer offset', () => {
    expect(todayLT(SUMMER)).toBe('2026-07-01')
    expect(nowLTMinutes(SUMMER)).toBe(12 * 60 + 15)
  })

  it('reports midnight as 0, not 24:00', () => {
    expect(nowLTMinutes(new Date('2026-01-14T22:00:00Z'))).toBe(0)
  })
})

describe('currentMinutesFor / isSlotOver', () => {
  it('returns -1 for any day other than today', () => {
    expect(currentMinutesFor('2026-07-02', SUMMER)).toBe(-1)
    expect(currentMinutesFor('2026-07-01', SUMMER)).toBe(735)
  })

  it('treats a slot as over once its end has passed', () => {
    expect(isSlotOver('12:00', 735)).toBe(false) // 12:00–12:30, now 12:15
    expect(isSlotOver('11:30', 735)).toBe(true)  // ended 12:00
    expect(isSlotOver('11:45', 735)).toBe(true)  // ends exactly 12:15
  })

  it('never marks slots over for non-today dates', () => {
    expect(isSlotOver('00:00', -1)).toBe(false)
  })

  it('works at exactly midnight (currentMinutes = 0)', () => {
    expect(isSlotOver('00:00', 0)).toBe(false)
  })
})

describe('isValidIsoDate', () => {
  it.each(['2026-01-01', '2028-02-29', '2026-12-31'])('accepts %s', d => {
    expect(isValidIsoDate(d)).toBe(true)
  })
  it.each(['2026-02-31', '2026-02-29', '2026-13-01', '2026-1-01', '20260101', '', '2026-01-01T00:00'])(
    'rejects %s', d => {
      expect(isValidIsoDate(d)).toBe(false)
    })
})

describe('date arithmetic', () => {
  it('crosses month, year and DST boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('computes weekday independent of server timezone', () => {
    expect(dayOfWeek('2026-11-25')).toBe(3) // Wednesday
    expect(dayOfWeek('2026-11-29')).toBe(0) // Sunday
  })

  it('builds forward and backward date windows from LT today', () => {
    expect(nextDatesLT(3, LATE_UTC)).toEqual(['2026-03-29', '2026-03-30', '2026-03-31'])
    expect(pastDatesLT(2, LATE_UTC)).toEqual(['2026-03-29', '2026-03-28'])
  })
})

describe('clock helpers', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(toMinutes('07:30')).toBe(450)
    expect(toMinutes('7:30')).toBe(450)
    expect(toMinutes('21:00:00')).toBe(1260)
  })

  it('throws on garbage so scrapers surface an error instead of NaN slots', () => {
    expect(() => toMinutes('abc')).toThrow()
  })

  it('treats midnight as end-of-day for range ends', () => {
    expect(toEndMinutes('00:00')).toBe(1440)
    expect(toEndMinutes('00:00:00')).toBe(1440)
    expect(toEndMinutes('23:00')).toBe(1380)
  })

  it('formats minutes', () => {
    expect(fromMinutes(450)).toBe('07:30')
    expect(fromMinutes(0)).toBe('00:00')
  })
})
