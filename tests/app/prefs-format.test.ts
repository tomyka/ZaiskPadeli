import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parsePrefs } from '../../app/utils/prefs'
import { formatPrice, ltPlural } from '../../app/utils/format'

describe('parsePrefs', () => {
  it('returns defaults for missing or non-object values', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('junk')).toEqual(DEFAULT_PREFS)
  })

  it('keeps valid values, including an explicit "all cities"', () => {
    expect(parsePrefs({ city: null, duration: 60, type: 'singles', indoor: false }))
      .toEqual({ city: null, duration: 60, type: 'singles', indoor: false })
  })

  it('replaces each tampered field with its default independently', () => {
    expect(parsePrefs({ city: 'Paris', duration: 45, type: 'unknown', indoor: 'yes' }))
      .toEqual({ ...DEFAULT_PREFS })
    expect(parsePrefs({ city: 'Vilnius', duration: '90' }))
      .toEqual({ ...DEFAULT_PREFS, city: 'Vilnius' })
  })
})

describe('formatPrice', () => {
  it('keeps whole euros short', () => {
    expect(formatPrice(42)).toBe('€42')
    expect(formatPrice(40.5)).toBe('€40.50')
  })
})

describe('ltPlural', () => {
  it('picks Lithuanian noun forms', () => {
    const f = (n: number) => ltPlural(n, 'kortas', 'kortai', 'kortų')
    expect([1, 2, 9, 10, 11, 15, 20, 21, 22, 111].map(f)).toEqual([
      'kortas', 'kortai', 'kortai', 'kortų', 'kortų', 'kortų', 'kortų', 'kortas', 'kortai', 'kortų',
    ])
  })
})
