import { describe, expect, it } from 'vitest'
import {
  COUNTY_OPTIONS, EVERYWHERE, chooseCounty, chooseMunicipality, isIn, locateAt, locationChoices, toLocation,
} from '../../app/utils/location'

const PRIENAI = { lat: 54.63, lng: 23.95 }
const VILNIUS = { lat: 54.69, lng: 25.28 }

describe('toLocation', () => {
  it('keeps a municipality only inside its county', () => {
    expect(toLocation('Kauno', 'Prienų r.')).toEqual({ county: 'Kauno', municipality: 'Prienų r.' })
    expect(toLocation('Vilniaus', 'Prienų r.')).toEqual({ county: 'Vilniaus', municipality: null })
    expect(toLocation(null, 'Kaunas')).toEqual(EVERYWHERE)
  })
})

describe('location moves', () => {
  const prienai = toLocation('Kauno', 'Prienų r.')

  it('choosing another county drops the municipality; re-choosing the same keeps it', () => {
    expect(chooseCounty(prienai, 'Vilniaus')).toEqual({ county: 'Vilniaus', municipality: null })
    expect(chooseCounty(prienai, 'Kauno')).toEqual(prienai)
    expect(chooseCounty(prienai, null)).toEqual(EVERYWHERE)
  })

  it('choosing a municipality brings its county along, so the pair is always valid', () => {
    expect(chooseMunicipality(toLocation('Vilniaus', null), 'Panevėžio r.')).toEqual({ county: 'Panevėžio', municipality: 'Panevėžio r.' })
    expect(chooseMunicipality(prienai, null)).toEqual({ county: 'Kauno', municipality: null })
  })

  it('GPS keeps the municipality when the position is in the selected county', () => {
    expect(locateAt(prienai, PRIENAI.lat, PRIENAI.lng)).toEqual(prienai)
    expect(locateAt(prienai, VILNIUS.lat, VILNIUS.lng)).toEqual({ county: 'Vilniaus', municipality: null })
    expect(locateAt(EVERYWHERE, PRIENAI.lat, PRIENAI.lng)).toEqual({ county: 'Kauno', municipality: null })
  })
})

describe('isIn', () => {
  it('matches the county, or only the municipality once narrowed', () => {
    expect(isIn(EVERYWHERE, 'Vilnius')).toBe(true)
    expect(isIn(toLocation('Kauno', null), 'Prienų r.')).toBe(true)
    expect(isIn(toLocation('Kauno', null), 'Vilnius')).toBe(false)
    expect(isIn(toLocation('Kauno', 'Kaunas'), 'Prienų r.')).toBe(false)
  })
})

describe('locationChoices', () => {
  it('offers municipalities city first, only when a county has venues in several', () => {
    expect(locationChoices(toLocation('Kauno', null)).municipalities).toEqual(['Kaunas', 'Prienų r.'])
    expect(locationChoices(toLocation('Panevėžio', 'Panevėžys')).municipalities).toEqual(['Panevėžys', 'Panevėžio r.'])
    expect(locationChoices(toLocation('Vilniaus', null)).municipalities).toEqual([])
    expect(locationChoices(EVERYWHERE).municipalities).toEqual([])
  })

  it('says when a county has no venues yet', () => {
    expect(locationChoices(toLocation('Šiaulių', null)).noVenuesText).toBe('Šiaulių apskrities kortų duomenų kol kas neturime.')
    expect(locationChoices(toLocation('Kauno', null)).noVenuesText).toBeNull()
    expect(locationChoices(EVERYWHERE).noVenuesText).toBeNull()
  })

  it('labels counties without venues as coming soon', () => {
    const label = (c: string) => COUNTY_OPTIONS.find(o => o.county === c)?.label
    expect(label('Kauno')).toBe('Kauno apskr.')
    expect(label('Utenos')).toBe('Utenos apskr. (greitai)')
    expect(COUNTY_OPTIONS).toHaveLength(10)
  })
})
