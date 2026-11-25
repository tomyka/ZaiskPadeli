import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFS, parsePrefs } from '../../app/utils/prefs'
import { formatPrice, ltPlural } from '../../app/utils/format'

describe('parsePrefs', () => {
  it('returns defaults for missing or non-object values', () => {
    expect(parsePrefs(undefined)).toEqual(DEFAULT_PREFS)
    expect(parsePrefs('junk')).toEqual(DEFAULT_PREFS)
  })

  it('keeps valid values, including an explicit "everywhere"', () => {
    expect(parsePrefs({ county: null, municipality: null, duration: 60, type: 'singles', indoor: false }))
      .toEqual({ county: null, municipality: null, duration: 60, type: 'singles', indoor: false })
    expect(parsePrefs({ county: 'Kauno', municipality: 'Prienų r.' }))
      .toEqual({ ...DEFAULT_PREFS, county: 'Kauno', municipality: 'Prienų r.' })
  })

  it('drops a municipality that is not in the chosen county, or has no county', () => {
    expect(parsePrefs({ county: 'Vilniaus', municipality: 'Prienų r.' }).municipality).toBeNull()
    expect(parsePrefs({ county: null, municipality: 'Kaunas' }).municipality).toBeNull()
  })

  it('maps a saved city from before counties to its county', () => {
    expect(parsePrefs({ city: 'Panevėžys', duration: 60 })).toMatchObject({ county: 'Panevėžio', municipality: null, duration: 60 })
    expect(parsePrefs({ city: null }).county).toBeNull()
    expect(parsePrefs({ city: 'Paris' }).county).toBe(DEFAULT_PREFS.county)
  })

  it('replaces each tampered field with its default independently', () => {
    expect(parsePrefs({ county: 'Paris', municipality: 'Atlantis', duration: 45, type: 'unknown', indoor: 'yes' }))
      .toEqual({ ...DEFAULT_PREFS })
    expect(parsePrefs({ county: 'Vilniaus', duration: '90' }))
      .toEqual({ ...DEFAULT_PREFS, county: 'Vilniaus' })
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
