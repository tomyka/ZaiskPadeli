import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixture, routeFetch } from './helpers/fake-fetch'
import { SCRAPERS, scraperFor, type ScraperSpec } from '../../server/utils/scraper-all'
import { VENUES, venueInfo, type VenueId } from '../../server/utils/venues'
import { LOGIN_REJECTED } from '../../server/utils/ntennis-fetch'

/**
 * Scrapers through their real interface, (date, venue) → Court[], with the network replaced
 * by saved responses: covers fetching, envelopes, guards and slot mapping together.
 */

/** Far future: nothing is "already over" */
const DATE = '2099-01-02'
const scrape = (id: VenueId, date = DATE) => scraperFor(SCRAPERS[id])(date, venueInfo(id)!)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('scraper registry', () => {
  it('builds a scraper for every venue', () => {
    for (const v of VENUES) expect(typeof scraperFor(SCRAPERS[v.id])).toBe('function')
  })

  // The booking link and the scraper config name the same place, so they must agree
  it.each(VENUES.map(v => [v.id, v.bookingUrl, SCRAPERS[v.id]] as [string, string, ScraperSpec]))(
    '%s links to the place it scrapes',
    (_id, bookingUrl, spec) => {
      if (spec.platform === 'moove') {
        expect(bookingUrl).toMatch(new RegExp(`^https://app\\.moove\\.lt/padel/club/reservation/\\d+\\?locationId=${spec.locationId}$`))
      }
      if (spec.platform === 'ntennis' && 'baseUrl' in spec) {
        expect(new URL(bookingUrl).origin).toBe(new URL(spec.baseUrl).origin)
      }
      if (spec.platform === 'playball') expect(bookingUrl).toContain(`/arenas/${spec.slug}/`)
    },
  )
})

describe('Winero', () => {
  const arena = {
    id: 'a77b94b4-46c0-4e7b-b69d-2ed700d3e483',
    opening_hours: 'Monday 07:00 – 23:00\\nTuesday 07:00 – 23:00\\nWednesday 07:00 – 23:00\\nThursday 07:00 – 23:00\\nFriday 07:00 – 23:00\\nSaturday 08:00 – 22:00\\nSunday 08:00 – 22:00',
    courts: [
      { id: 'c1', name: 'Kortas 1', price_periods: [{ days: ['friday'], time_slots: [{ start_time: '07:00', end_time: '23:00', price: 30 }] }] },
      { id: 'c2', name: 'Single kortas' },
    ],
  }

  it('inverts booked ranges against the opening hours, with per-half-hour prices', async () => {
    const urls = routeFetch({
      '/api/arenas/': arena,
      'public-availability': { data: [{ court_id: 'c1', start_time: '08:00', end_time: '09:00' }] },
    })
    const courts = await scrape('zirmunai')
    expect(urls.some(u => u.includes(`date=${DATE}`))).toBe(true)
    expect(courts.map(c => [c.id, c.type])).toEqual([['zirmunai-c1', 'doubles'], ['zirmunai-c2', 'singles']])
    expect(courts[0]!.slots).toHaveLength(32) // Friday 07:00–23:00
    expect(courts[0]!.slots.slice(0, 5)).toEqual([
      { time: '07:00', available: true, price: 15 },
      { time: '07:30', available: true, price: 15 },
      { time: '08:00', available: false, price: null },
      { time: '08:30', available: false, price: null },
      { time: '09:00', available: true, price: 15 },
    ])
  })

  it('fails when the arena is unknown', async () => {
    routeFetch({ '/api/arenas/': {}, 'public-availability': { data: [] } })
    await expect(scrape('zirmunai')).rejects.toThrow('Arena not found')
  })
})

describe('Simonas', () => {
  it('treats working-hours slots the API does not list as booked', async () => {
    routeFetch({
      'availabilities?type=PADEL&year=2099&month=1&day=2': {
        availabilities: [{
          court: { id: 7, name: '1', workingHours: { fromTime: '2099-01-02T07:00:00+02:00', toTime: '2099-01-02T09:00:00+02:00' } },
          slots: [{ fromTime: '2099-01-02T07:30:00+02:00', toTime: '2099-01-02T08:00:00+02:00', price: 12 }],
        }],
      },
    })
    const [court] = await scrape('simonas')
    expect(court).toMatchObject({ id: 'simonas-7', name: 'Kortas 1' })
    expect(court!.slots).toEqual([
      { time: '07:00', available: false, price: null },
      { time: '07:30', available: true, price: 12 },
      { time: '08:00', available: false, price: null },
      { time: '08:30', available: false, price: null },
    ])
  })
})

describe('Padelis Prienuose', () => {
  it('keeps only the requested date\'s bookings, by slot id', async () => {
    routeFetch({
      'booked-dates': [
        { date: DATE, time_id: 1 },
        { date: DATE, time_id: '3' },
        { date: '2099-01-03', time_id: 2 },
      ],
    })
    const [court] = await scrape('prienuose')
    expect(court!.slots).toHaveLength(28) // 08:00–22:00
    expect(court!.slots.slice(0, 3)).toEqual([
      { time: '08:00', available: false, price: null },
      { time: '08:30', available: true, price: 8 },
      { time: '09:00', available: false, price: null },
    ])
  })
})

describe('Moove', () => {
  it('reads a whole day of tickets', async () => {
    routeFetch({ 'locationIds=227': new Response(fixture('moove-tickets.json')) })
    const courts = await scrape('kpadel')
    expect(courts.map(c => c.name)).toEqual(['K1 PADELCRUSH', 'K2 BAKIN', 'K3 BROLIŲ MEDUS', 'K4 OMG FIBRE SODA'])
  })

  it('fails rather than show a day cut short by paging', async () => {
    routeFetch({ 'locationIds=227': { content: [], totalElements: 400 } })
    await expect(scrape('kpadel')).rejects.toThrow('Day truncated: 0 of 400 tickets')
  })
})

describe('Playball', () => {
  const json = (name: string) => JSON.parse(fixture(`playball/${name}.json`))

  it('reads paged and bare-array list responses alike', async () => {
    routeFetch({
      '/clubs/by-slug/padel-spot-arena': json('club'),
      '/courts/booked-slots/': json('booked'),
      '/price-policies': json('policies'),
      '/courts?club_id=': json('courts'),
    })
    const courts = await scrape('padelspot', '2026-11-27')
    expect(courts.map(c => c.name)).toEqual(['Donutz Digital U1', 'Northway U2', 'Inv. Parkas U3', 'Inv. Parkas U4'])
    expect(courts[0]!.slots.find(s => s.time === '09:00')!.available).toBe(false)
  })
})

describe('Cloudflare-protected sites', () => {
  const goPadelAvailability = JSON.parse(fixture('gopadel-availability.json')).data
  const facility = { id: 1, courts: [{ id: 1, name: '1 kortas' }, { id: 2, name: '2 GERDNESTA kortas' }] }

  it('fetch GO Padel directly when no proxy is configured (local dev)', async () => {
    vi.stubEnv('CF_PROXY_URL', '')
    routeFetch({
      'api.gopadel.lt/session': new Response(null, { status: 200 }),
      'api.gopadel.lt/facilities/1/availability': { success: true, data: goPadelAvailability },
      'api.gopadel.lt/facilities': { success: true, data: [facility] },
    })
    const courts = await scrape('gopadel')
    expect(courts.map(c => c.name)).toEqual(['1 kortas', '2 GERDNESTA kortas'])
  })

  it('go through the Worker when the proxy is configured, and never fall back to a direct fetch', async () => {
    vi.stubEnv('CF_PROXY_URL', 'https://proxy.example')
    vi.stubEnv('CF_PROXY_TOKEN', 't')
    const urls = routeFetch({ 'proxy.example?site=gopadel': { facility, availability: goPadelAvailability } })
    expect(await scrape('gopadel')).toHaveLength(2)
    expect(urls).toEqual([`https://proxy.example?site=gopadel&date=${DATE}`])
  })

  it('report the Worker\'s error', async () => {
    vi.stubEnv('CF_PROXY_URL', 'https://proxy.example')
    vi.stubEnv('CF_PROXY_TOKEN', 't')
    routeFetch({ 'proxy.example': Response.json({ error: '/facilities: HTTP 403' }, { status: 502 }) })
    await expect(scrape('gopadel')).rejects.toThrow('Proxy HTTP 502: /facilities: HTTP 403')
  })

  it('reject a Worker answer without GO Padel data', async () => {
    vi.stubEnv('CF_PROXY_URL', 'https://proxy.example')
    vi.stubEnv('CF_PROXY_TOKEN', 't')
    routeFetch({ 'proxy.example': {} })
    await expect(scrape('gopadel')).rejects.toThrow(/No GO Padel facility/)
  })

  it('parse the Kauno Padelio Klubas grid the Worker fetched', async () => {
    vi.stubEnv('CF_PROXY_URL', 'https://proxy.example')
    vi.stubEnv('CF_PROXY_TOKEN', 't')
    routeFetch({ 'proxy.example?site=kaunopadelis': { html: fixture('ntennis-grid.html'), status: 200, loginStatus: 302, loginRejected: false } })
    const courts = await scrape('kaunopadelis')
    expect(courts[0]!.id).toMatch(/^kaunopadelis-/)
  })

  it('understand a rejected login from older Worker builds too', async () => {
    vi.stubEnv('CF_PROXY_URL', 'https://proxy.example')
    vi.stubEnv('CF_PROXY_TOKEN', 't')
    routeFetch({ 'proxy.example': { html: '', status: 200, loginStatus: 200, error: LOGIN_REJECTED } })
    await expect(scrape('kaunopadelis')).rejects.toThrow(LOGIN_REJECTED)
  })
})
