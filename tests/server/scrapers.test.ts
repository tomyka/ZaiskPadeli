import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseNTennisGrid } from '../../server/utils/ntennis'
import { padelHubSlotTime, parsePadelHubCourts } from '../../server/utils/scraper-padelhub'
import { parsePadelHouseHtml } from '../../server/utils/scraper-padelhouse'
import { getPriceForSlot, parseOpeningHours, type WineroCourt } from '../../server/utils/scraper-winero'

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8')

describe('parseNTennisGrid', () => {
  const html = fixture('ntennis-grid.html')

  it('maps cells to half-hour slots with legend prices (per hour / 2)', () => {
    const [court1] = parseNTennisGrid(html, { idPrefix: 'ts', currentMinutes: -1 })
    expect(court1).toMatchObject({ id: 'ts-kortas-1-dvejetų', type: 'doubles' })
    expect(court1!.slots).toEqual([
      { time: '07:00', available: true, price: 10 },
      { time: '07:30', available: false, price: null },
      { time: '08:00', available: true, price: 12.75 },
      { time: '08:30', available: false, price: null },
    ])
  })

  it('detects singles courts and unknown colours yield null price', () => {
    const singles = parseNTennisGrid(html, { idPrefix: 'ts', currentMinutes: -1 })[1]!
    expect(singles.type).toBe('singles')
    expect(singles.slots[1]).toEqual({ time: '07:30', available: true, price: null })
  })

  it('skips rows without a court name', () => {
    expect(parseNTennisGrid(html, { idPrefix: 'ts', currentMinutes: -1 })).toHaveLength(2)
  })

  it('marks already-finished slots unavailable when the grid is for today', () => {
    const [, singles] = parseNTennisGrid(html, { idPrefix: 'ts', currentMinutes: 8 * 60 + 30 })
    expect(singles!.slots.map(s => s.available)).toEqual([false, false, false, true])
  })

  it('can read the court name from the first span only (A1Padel)', () => {
    const [court1] = parseNTennisGrid(html, { idPrefix: 'a1', currentMinutes: -1, nameFromSpan: true })
    expect(court1!.name).toBe('Kortas 1')
  })

  it('returns no courts for a login page', () => {
    expect(parseNTennisGrid('<form id="LoginForm"></form>', { idPrefix: 'x', currentMinutes: -1 })).toEqual([])
  })
})

describe('padelHubSlotTime', () => {
  it('maps the 1-based half-hour timeIdentifier like the booking site does', () => {
    expect(padelHubSlotTime(1)).toBe('00:00')
    expect(padelHubSlotTime(14)).toBe('06:30')
    expect(padelHubSlotTime(15)).toBe('07:00')
    expect(padelHubSlotTime(45)).toBe('22:00')
  })
})

describe('parsePadelHubCourts', () => {
  it('keeps padel courts only and maps slots', () => {
    const courts = parsePadelHubCourts([
      {
        id: 1, tab: 'Padelis', name: 'Padelio dvejetų kortas \n1 „Ąžuolo klinika“',
        times: [{ timeIdentifier: 15, isReserved: false, price: 10 }, { timeIdentifier: 16, isReserved: true, price: 12 }],
      },
      { id: 5, tab: 'skvosas', name: '1 skvošo kortas', times: [{ timeIdentifier: 15, isReserved: false, price: 9 }] },
    ], 'padelhub')
    expect(courts).toEqual([{
      id: 'padelhub-1',
      name: '#1 Ąžuolo klinika',
      type: 'doubles',
      slots: [
        { time: '07:00', available: true, price: 10 },
        { time: '07:30', available: false, price: 12 },
      ],
    }])
  })
})

describe('parsePadelHouseHtml', () => {
  const html = fixture('padelhouse.html')

  it('parses the desktop table only, using current (non-promo-struck) decimal prices', () => {
    const courts = parsePadelHouseHtml(html, -1, 'padelhouse')
    expect(courts).toHaveLength(1)
    expect(courts[0]).toMatchObject({ id: 'padelhouse-1', name: 'Kortas 1' })
    expect(courts[0]!.slots).toEqual([
      { time: '20:00', available: true, price: 12 },
      { time: '20:30', available: false, price: null },
      { time: '21:00', available: true, price: 16.25 },
      { time: '21:30', available: true, price: 16.25 },
    ])
  })

  it('marks past slots unavailable for today', () => {
    // 21:10 — the 20:00 slot has ended, the 21:00 slot is still in progress
    const slots = parsePadelHouseHtml(html, 21 * 60 + 10, 'padelhouse')[0]!.slots
    expect(slots.map(s => s.available)).toEqual([false, false, true, true])
  })
})

describe('Winero helpers', () => {
  const hours = 'Monday 06:00 – 23:00\\nTuesday 6:00 - 22:00\\nSunday 08:00 – 00:00'

  it('picks the opening hours for the date\'s weekday', () => {
    expect(parseOpeningHours(hours, '2026-11-23')).toEqual({ open: '06:00', close: '23:00' }) // Mon
    expect(parseOpeningHours(hours, '2026-11-24')).toEqual({ open: '06:00', close: '22:00' }) // Tue
    expect(parseOpeningHours(hours, '2026-11-29')).toEqual({ open: '08:00', close: '00:00' }) // Sun
    expect(parseOpeningHours(hours, '2026-11-25')).toBeNull() // Wed missing
  })

  const court: WineroCourt = {
    id: 'c1',
    name: 'Kortas 1',
    price_periods: [
      { days: ['monday'], time_slots: [
        { start_time: '06:00:00', end_time: '17:00:00', price: 20 },
        { start_time: '17:00:00', end_time: '00:00:00', price: 30 },
      ] },
    ],
    exception_price_periods: [
      { start_date: '2026-12-21', end_date: '2026-12-21', days: ['monday'], time_slots: [
        { start_time: '06:00:00', end_time: '00:00:00', price: 10 },
      ] },
    ],
  }

  it('returns half the hourly price for the matching period', () => {
    expect(getPriceForSlot(court, '2026-11-23', '10:00')).toBe(10)
    expect(getPriceForSlot(court, '2026-11-23', '17:00')).toBe(15)
  })

  it('treats a "00:00:00" period end as midnight (regression: late slots had no price)', () => {
    expect(getPriceForSlot(court, '2026-11-23', '23:30')).toBe(15)
  })

  it('prefers exception periods within their date range', () => {
    expect(getPriceForSlot(court, '2026-12-21', '18:00')).toBe(5)
    expect(getPriceForSlot(court, '2026-12-28', '18:00')).toBe(15)
  })

  it('returns null for days without a period', () => {
    expect(getPriceForSlot(court, '2026-11-24', '10:00')).toBeNull()
  })
})
