import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildPlayballCourts, type PlayballDay } from '../../server/utils/scraper-playball'

const load = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/playball/${name}.json`, import.meta.url)), 'utf8'))
const list = (b: any) => (Array.isArray(b) ? b : b.items)

// Padel Spot Arena, Friday 2026-11-27
const DATE = '2026-11-27'
const day: PlayballDay = { club: load('club'), courts: list(load('courts')), booked: list(load('booked')), policies: list(load('policies')) }

describe('buildPlayballCourts', () => {
  const courts = buildPlayballCourts(day, DATE, 'padelspot')
  const court = (id: number) => courts.find(c => c.id === `padelspot-${id}`)!
  const slot = (id: number, time: string) => court(id).slots.find(s => s.time === time)!

  it('lists the active padel courts over the working hours (08:00–23:00)', () => {
    expect(courts.map(c => c.name)).toEqual(['Donutz Digital U1', 'Northway U2', 'Inv. Parkas U3', 'Inv. Parkas U4'])
    expect(court(50).slots).toHaveLength(30)
    expect(court(50).slots[0]!.time).toBe('08:00')
    expect(court(50).slots.at(-1)!.time).toBe('22:30')
    expect(court(50).indoor).toBe(true)
  })

  it('marks every half hour a booking overlaps as taken', () => {
    expect(slot(50, '09:00').available).toBe(false)  // 09:00–10:00
    expect(slot(50, '14:00').available).toBe(false)  // 13:00–14:30
    expect(slot(50, '14:30').available).toBe(true)
    expect(slot(58, '16:30').available).toBe(true)
    expect(slot(58, '17:00').available).toBe(false)  // 17:00–19:00
  })

  it('prices free slots per half hour from the weekday segments', () => {
    expect(slot(58, '08:00').price).toBe(10) // weekday 08–13
    expect(slot(58, '13:00').price).toBe(12) // weekday 13–17
    expect(slot(50, '09:00').price).toBeNull() // booked
  })

  it('uses the weekend segment and the weekday opening hours of the date', () => {
    const sat = buildPlayballCourts({ ...day, booked: [] }, '2026-11-28', 'padelspot')
    expect(sat[0]!.slots.find(s => s.time === '18:00')!.price).toBe(11)
  })

  it('returns no courts on a closed day and marks slots already over', () => {
    const closed = { ...day, club: { ...day.club, working_hours: day.club.working_hours.map(h => ({ ...h, is_active: false })) } }
    expect(buildPlayballCourts(closed, DATE, 'x')).toEqual([])
    const late = buildPlayballCourts({ ...day, booked: [] }, DATE, 'x', 10 * 60)
    expect(late[0]!.slots.find(s => s.time === '09:00')!.available).toBe(false)
  })
})
