import { describe, expect, it, vi } from 'vitest'
import { createAvailabilityStore, memoryAvailabilityStorage } from '../../server/utils/availability-store'
import type { Court, Venue } from '../../server/utils/types'

const DATE = '2026-11-26'
const MIN = 60_000
const court: Court = { id: 'x-1', name: 'Kortas 1', type: 'doubles', slots: [{ time: '10:00', available: true, price: 20 }] }

/** A store with a controllable clock and a scrape that returns whatever `next` says */
function setup() {
  let clock = Date.parse('2026-11-25T12:00:00Z')
  let next: (now: number) => Venue[] = now => [good('a', now), good('b', now)]
  const scrape = vi.fn(async () => next(clock))
  const store = createAvailabilityStore({ storage: memoryAvailabilityStorage(), scrape, now: () => clock })
  return {
    store,
    scrape,
    advance: (ms: number) => { clock += ms },
    scrapeReturns: (fn: (now: number) => Venue[]) => { next = fn },
  }
}

function good(id: string, now: number): Venue {
  return { id, name: id, address: '', municipality: 'Kaunas', bookingUrl: '', courts: [court], lastUpdated: new Date(now).toISOString(), status: 'ok' }
}
function failed(id: string, now: number): Venue {
  return { ...good(id, now), courts: [], status: 'failed' }
}

describe('availability store', () => {
  it('serves fresh stored data without scraping again', async () => {
    const { store, scrape, advance } = setup()
    const first = await store.get(DATE)
    advance(4 * MIN)
    const second = await store.get(DATE)
    expect(scrape).toHaveBeenCalledTimes(1)
    expect(first).toMatchObject({ fromCache: false, cacheAgeSeconds: 0 })
    expect(second).toMatchObject({ fromCache: true, cacheAgeSeconds: 240, fetchedAt: first.fetchedAt })
  })

  it('scrapes again once stored data is past the fresh window', async () => {
    const { store, scrape, advance } = setup()
    await store.get(DATE)
    advance(6 * MIN)
    expect((await store.get(DATE)).fromCache).toBe(false)
    expect(scrape).toHaveBeenCalledTimes(2)
  })

  it('shares one scrape between concurrent callers for a date', async () => {
    const { store, scrape } = setup()
    const [a, b, c] = await Promise.all([store.get(DATE), store.refresh(DATE), store.get(DATE)])
    expect(scrape).toHaveBeenCalledTimes(1)
    expect(b.data).toEqual(a)
    expect(c).toEqual(a)
  })

  it('always scrapes on refresh, even when fresh data is stored', async () => {
    const { store, scrape } = setup()
    await store.get(DATE)
    await store.refresh(DATE)
    expect(scrape).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed venue\'s last good courts and their timestamp', async () => {
    const { store, advance, scrapeReturns } = setup()
    const before = await store.get(DATE)
    advance(20 * MIN)
    scrapeReturns(now => [failed('a', now), good('b', now)])
    const { data, carried } = await store.refresh(DATE)
    expect(carried).toEqual(['a'])
    expect(data.venues[0]).toMatchObject({ id: 'a', courts: [court], status: 'stale', lastUpdated: before.venues[0]!.lastUpdated })
  })

  it('carries over every venue when the whole scrape fails', async () => {
    const { store, advance, scrapeReturns } = setup()
    await store.get(DATE)
    advance(10 * MIN)
    scrapeReturns(now => [failed('a', now), failed('b', now)])
    const { data, carried } = await store.refresh(DATE)
    expect(carried).toEqual(['a', 'b'])
    expect(data.venues.every(v => v.status === 'stale' && v.courts.length)).toBe(true)
  })

  it('lets carried data expire by the venue\'s own age, not the entry\'s', async () => {
    const { store, advance, scrapeReturns } = setup()
    await store.get(DATE)
    scrapeReturns(now => [failed('a', now), good('b', now)])
    advance(40 * MIN)
    expect((await store.refresh(DATE)).carried).toEqual(['a']) // 40 min old: kept
    advance(25 * MIN)
    const { data, carried } = await store.refresh(DATE) // entry is 25 min old, venue a's data 65 min
    expect(carried).toEqual([])
    expect(data.venues[0]!.status).toBe('failed')
  })

  it('does not replace an empty day or a venue with no previous data', async () => {
    const { store, advance, scrapeReturns } = setup()
    scrapeReturns(now => [good('a', now)])
    await store.get(DATE)
    advance(10 * MIN)
    scrapeReturns(now => [{ ...good('a', now), courts: [], status: 'empty' }, failed('c', now)])
    const { data, carried } = await store.refresh(DATE)
    expect(carried).toEqual([])
    expect(data.venues.map(v => v.status)).toEqual(['empty', 'failed'])
  })

  it('treats a malformed stored entry as a miss', async () => {
    const storage = memoryAvailabilityStorage()
    await storage.set('avail:v5:' + DATE, { storedAt: Number.NaN } as never, 60)
    const scrape = vi.fn(async () => [good('a', 0)])
    const store = createAvailabilityStore({ storage, scrape })
    expect((await store.get(DATE)).fromCache).toBe(false)
    expect(scrape).toHaveBeenCalledTimes(1)
  })

  it('ignores stored data past the stale window', async () => {
    const { store, advance, scrapeReturns } = setup()
    await store.get(DATE)
    advance(61 * MIN)
    scrapeReturns(now => [failed('a', now), good('b', now)])
    expect((await store.refresh(DATE)).carried).toEqual([])
  })
})
