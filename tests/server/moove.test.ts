import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseMooveTickets, type MooveTicket } from '../../server/utils/scraper-moove'

const tickets = (JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/moove-tickets.json', import.meta.url)), 'utf8')) as { content: MooveTicket[] }).content

describe('parseMooveTickets', () => {
  const courts = parseMooveTickets(tickets, 'kpadel', -1)

  it('groups tickets into courts in the club order and skips the ball machine', () => {
    expect(courts.map(c => c.name)).toEqual(['K1 PADELCRUSH', 'K2 BAKIN', 'K3 BROLIŲ MEDUS', 'K4 OMG FIBRE SODA'])
    expect(courts[0]!.id).toMatch(/^kpadel-\d+$/)
  })

  it('maps "free" to available with the price in euros; booked tickets have no price', () => {
    expect(courts[0]!.slots).toEqual([
      { time: '17:00', available: true, price: 15 },
      { time: '17:30', available: true, price: 15 },
    ])
    expect(courts[3]!.slots).toEqual([
      { time: '17:00', available: false, price: null },
      { time: '17:30', available: false, price: null },
    ])
  })

  it('marks slots that are already over as unavailable (a slot under way still counts)', () => {
    const late = parseMooveTickets(tickets, 'kpadel', 17 * 60 + 45)
    expect(late[0]!.slots.map(s => s.available)).toEqual([false, true])
  })

  it('takes indoor from the config, else from a "laukas" court name', () => {
    expect(courts[0]!.indoor).toBe(true)
    expect(parseMooveTickets(tickets, 'x', -1, { indoor: false })[0]!.indoor).toBe(false)
    const outdoor = parseMooveTickets([{ ...tickets[0]!, court: { id: 9, name: 'Laukas 1' } }], 'x', -1)
    expect(outdoor[0]!.indoor).toBe(false)
  })
})
