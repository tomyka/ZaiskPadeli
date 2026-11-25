import { describe, expect, it } from 'vitest'
import { expandHourHeader, parseBgColor, parseEuro } from '../../server/utils/parse'
import { extractSetCookies, mergeCookies } from '../../server/utils/cookies'

describe('parseEuro', () => {
  it('handles integers and decimal commas/points', () => {
    expect(parseEuro('24 €')).toBe(24)
    expect(parseEuro('Kaina: 12,50 € / val.')).toBe(12.5)
    expect(parseEuro('12.5€')).toBe(12.5)
  })

  it('returns the whole amount, not the cents part (regression: "12,50 €" was read as 50)', () => {
    expect(parseEuro('12,50 €')).not.toBe(50)
  })

  it('returns null when no amount', () => {
    expect(parseEuro('Užimta')).toBeNull()
  })
})

describe('parseBgColor', () => {
  it('extracts and lower-cases hex colours', () => {
    expect(parseBgColor('width: 10px; background-color: #A1B2C3;')).toBe('#a1b2c3')
    expect(parseBgColor('background-color:#fff')).toBe('#fff')
  })

  it('returns null when absent', () => {
    expect(parseBgColor(undefined)).toBeNull()
    expect(parseBgColor('color: red')).toBeNull()
  })
})

describe('expandHourHeader', () => {
  it('splits an hour header into two half-hour slots', () => {
    expect(expandHourHeader(' 07:00 ')).toEqual(['07:00', '07:30'])
    expect(expandHourHeader('7:00')).toEqual(['07:00', '07:30'])
  })

  it('rolls over correctly for half-past headers (regression: produced "07:60")', () => {
    expect(expandHourHeader('07:30')).toEqual(['07:30', '08:00'])
  })

  it('ignores non-time headers', () => {
    expect(expandHourHeader('Kortas')).toEqual([])
  })
})

describe('cookies', () => {
  it('splits a combined Set-Cookie header without breaking on Expires commas', () => {
    const headers = new Headers()
    headers.append('set-cookie', 'PHPSESSID=abc; path=/; expires=Thu, 01 Jan 2099 00:00:00 GMT')
    headers.append('set-cookie', 'YII_CSRF_TOKEN=xyz; path=/')
    expect(extractSetCookies(headers)).toEqual(['PHPSESSID=abc', 'YII_CSRF_TOKEN=xyz'])
  })

  it('later cookies override earlier ones by name', () => {
    expect(mergeCookies(['a=1', 'b=2'], ['a=3'])).toEqual(['a=3', 'b=2'])
  })
})
