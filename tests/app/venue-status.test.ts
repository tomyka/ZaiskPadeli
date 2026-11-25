import { describe, expect, it } from 'vitest'
import { staleNote, venueProblem } from '../../app/utils/venue-status'

describe('venue status wording', () => {
  it('explains only statuses with nothing to show', () => {
    expect(venueProblem({ status: 'failed' })).toBe('Nepavyko gauti duomenų')
    expect(venueProblem({ status: 'empty' })).toBe('Nėra duomenų šiai dienai')
    expect(venueProblem({ status: 'ok' })).toBeNull()
    expect(venueProblem({ status: 'stale' })).toBeNull()
  })

  it('dates older data in Lithuanian time', () => {
    expect(staleNote({ status: 'stale', lastUpdated: '2026-11-25T12:05:00Z' })).toBe('duomenys 14:05')
    expect(staleNote({ status: 'ok', lastUpdated: '2026-11-25T12:05:00Z' })).toBeNull()
  })
})
