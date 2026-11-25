import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildPadelinCourts, padelinSlotPrice, parsePadelinTimes } from '../../server/utils/scraper-padelin'

const html = readFileSync(fileURLToPath(new URL('../fixtures/padelin-times.html', import.meta.url)), 'utf8')

describe('parsePadelinTimes', () => {
  it('reads the free start times from the endpoint\'s select', () => {
    const times = parsePadelinTimes(html)
    expect(times).toHaveLength(20)
    expect(times.slice(0, 3)).toEqual(['07:00', '07:30', '08:00'])
    expect(times).toContain('14:00')
    expect(times).not.toContain('14:30') // booked through 20:00
    expect(times).toContain('20:30')
  })

  it('returns nothing for an empty response', () => {
    expect(parsePadelinTimes('<select name="start_of_play"></select>')).toEqual([])
  })
})

describe('padelinSlotPrice', () => {
  it('uses weekday day / evening and weekend rates, per half hour', () => {
    expect(padelinSlotPrice('doubles', '2026-11-26', '15:30')).toBe(12) // Thu, €24/h
    expect(padelinSlotPrice('doubles', '2026-11-26', '16:00')).toBe(16) // Thu evening, €32/h
    expect(padelinSlotPrice('doubles', '2026-11-28', '10:00')).toBe(14) // Sat, €28/h
    expect(padelinSlotPrice('singles', '2026-11-26', '18:00')).toBe(11) // Thu evening, €22/h
  })
})

describe('buildPadelinCourts', () => {
  it('lays free starts over 07:00–23:00, prices only free slots, and types courts', () => {
    const courts = buildPadelinCourts({ f1: ['07:00', '22:30'], f3: ['16:00'] }, '2026-11-26', 'padelin')
    expect(courts.map(c => [c.id, c.type])).toEqual([['padelin-f1', 'doubles'], ['padelin-f2', 'doubles'], ['padelin-f3', 'singles']])
    expect(courts[0]!.slots).toHaveLength(32)
    expect(courts[0]!.slots[0]).toEqual({ time: '07:00', available: true, price: 12 })
    expect(courts[0]!.slots[1]).toEqual({ time: '07:30', available: false, price: null })
    expect(courts[1]!.slots.every(s => !s.available)).toBe(true)
    expect(courts[2]!.slots.find(s => s.time === '16:00')).toEqual({ time: '16:00', available: true, price: 11 })
  })

  it('marks slots that are already over as unavailable', () => {
    const courts = buildPadelinCourts({ f1: ['07:00', '12:00'] }, '2026-11-26', 'padelin', 10 * 60)
    expect(courts[0]!.slots[0]!.available).toBe(false)
    expect(courts[0]!.slots.find(s => s.time === '12:00')!.available).toBe(true)
  })
})
