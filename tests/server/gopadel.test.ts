import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseGoPadel } from '../../server/utils/scraper-gopadel'
import { fetchGoPadelDay, type GoPadelAvailability } from '../../server/utils/gopadel-fetch'

const availability = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/gopadel-availability.json', import.meta.url)), 'utf8')).data as GoPadelAvailability
const facility = { id: 1, courts: [{ id: 1, name: '1 kortas' }, { id: 2, name: '2 GERDNESTA kortas' }] }

describe('parseGoPadel', () => {
  const courts = parseGoPadel(facility, availability, 'gopadel')

  it('names courts from the facility and prefixes ids with the venue id', () => {
    expect(courts.map(c => [c.id, c.name, c.type])).toEqual([
      ['gopadel-1', '1 kortas', 'doubles'],
      ['gopadel-2', '2 GERDNESTA kortas', 'doubles'],
    ])
  })

  it('maps statuses to availability and per-hour prices to per-half-hour', () => {
    expect(courts[0]!.slots).toEqual([
      { time: '15:00', available: true, price: 14 },
      { time: '15:30', available: true, price: 14 },
      { time: '16:00', available: true, price: 18 },
      { time: '16:30', available: false, price: null },
      { time: '17:00', available: false, price: null },
      { time: '17:30', available: false, price: null },
    ])
  })

  it('treats past slots as unavailable', () => {
    const past = parseGoPadel(facility, { courts: [{ courtId: 1, slots: [{ start: '08:00', status: 'past', pricePerHour: 14 }] }] }, 'gopadel')
    expect(past[0]!.slots[0]).toEqual({ time: '08:00', available: false, price: null })
  })

  it('falls back to a generic name for a court missing from the facility', () => {
    const extra = parseGoPadel(facility, { courts: [{ courtId: 99, slots: [] }] }, 'gopadel')
    expect(extra[0]!.name).toBe('Kortas 99')
  })
})

describe('fetchGoPadelDay', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports the HTTP status when Cloudflare answers with an HTML challenge', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(null, { status: 200 })
        : new Response('<!DOCTYPE html><title>Just a moment...</title>', { status: 403, headers: { 'Content-Type': 'text/html' } })))
    await expect(fetchGoPadelDay('2026-11-27')).rejects.toThrow(/HTTP 403/)
  })

  it('reports the API message on a JSON error envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/session')
        ? new Response(null, { status: 200 })
        : Response.json({ success: false, message: 'Bad date', data: null }, { status: 400 })))
    await expect(fetchGoPadelDay('2026-11-27')).rejects.toThrow(/HTTP 400 Bad date/)
  })
})
