import { load } from 'cheerio'
import type { Court, TimeSlot } from './types'
import { expandHourHeader, parseBgColor, parseEuro } from './parse'
import { isSlotOver } from './time'

/**
 * Pure parser for nTennis/nSoft "reservation/short" grid HTML
 * (Tennis Space, Vilnius Padel Arena, Kauno Padelio Klubas, A1Padel).
 *
 * Grid shape: one <th> per hour in <thead>; each court row has a sticky name cell
 * followed by two <td> per hour (kaire = :00, desine = :30). Cell classes encode
 * state (booking-slot-available / booking-slot-na / full / past) and the inline
 * background colour maps to a price tier in the `.legend-item` list (per hour).
 */

export interface NTennisGridOptions {
  /** Court id prefix, e.g. "tennisspace" → "tennisspace-kortas-1" */
  idPrefix: string
  /** Minutes since midnight if the grid is for today, else -1 (see currentMinutesFor) */
  currentMinutes: number
  /** A1Padel wraps the court name in a <span> next to extra text — read only that span */
  nameFromSpan?: boolean
}

export function parseNTennisGrid(html: string, opts: NTennisGridOptions): Court[] {
  const $ = load(html)

  // Colour → price per 30-min slot (legend shows per-hour prices)
  const colorPrice = new Map<string, number>()
  $('.legend-item').each((_, el) => {
    const color = parseBgColor($(el).find('span[style]').attr('style'))
    const price = parseEuro($(el).text())
    if (color && price !== null) colorPrice.set(color, price / 2)
  })

  // Fallback: some installs render the legend swatch without span[style]
  if (colorPrice.size === 0) {
    const legend = html.match(/class="legend"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
    const colors = [...legend.matchAll(/background-color:\s*(#[0-9a-fA-F]{3,8})/gi)]
    const prices = [...legend.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)]
    colors.forEach((c, i) => {
      const p = prices[i]?.[1]
      if (c[1] && p) colorPrice.set(c[1].toLowerCase(), Number.parseFloat(p.replace(',', '.')) / 2)
    })
  }

  const slotTimes: string[] = []
  $('thead th').each((_, el) => { slotTimes.push(...expandHourHeader($(el).text())) })

  const courts: Court[] = []
  $('tr').each((_, row) => {
    const nameEl = $(row).find('td.rbt-sticky-col, th.rbt-sticky-col')
    const courtName = (opts.nameFromSpan && nameEl.find('span').first().text().trim()) || nameEl.text().trim()
    if (!courtName) return

    const slots: TimeSlot[] = []
    let slotIdx = 0

    $(row).find('td').each((_, cell) => {
      const classes = $(cell).attr('class') || ''
      if (classes.includes('rbt-sticky-col')) return

      const isAvailable = classes.includes('booking-slot-available')
      const isBooked = classes.includes('booking-slot-na') || classes.includes('full')
      const isPast = classes.includes('past')
      if (!isAvailable && !isBooked && !isPast) return

      const time = slotTimes[slotIdx++]
      if (!time) return

      const available = isAvailable && !isSlotOver(time, opts.currentMinutes)
      const color = parseBgColor($(cell).attr('style'))
      const price = available && color ? (colorPrice.get(color) ?? null) : null
      slots.push({ time, available, price })
    })

    if (slots.length === 0) return
    courts.push({
      id: `${opts.idPrefix}-${courtName.replace(/\s+/g, '-').toLowerCase()}`,
      name: courtName,
      type: courtName.toLowerCase().includes('vienet') ? 'singles' : 'doubles',
      slots,
    })
  })

  return courts
}
