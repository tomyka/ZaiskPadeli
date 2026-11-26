import { load, type CheerioAPI } from 'cheerio'
import type { Court } from './types'
import { courtTypeFromName, expandHourHeader, parseBgColor, parseEuro } from './parse'
import { perHalfHour, toSlots } from './day-grid'

/**
 * Pure parser for nTennis/nSoft "reservation/short" grid HTML
 * (every nTennis venue: see the ntennis entries in scraper-all.ts).
 *
 * Grid shape: one <th> per hour in <thead>; each court row has a name cell followed by
 * two <td> per hour (kaire = :00, desine = :30). Cell classes encode state
 * (booking-slot-available / booking-slot-na / full / past) and a free cell's inline
 * background colour is its price tier, listed with a per-hour price in the legend.
 */

export interface NTennisGridOptions {
  /** Court id prefix, e.g. "tennisspace" → "tennisspace-kortas-1" */
  idPrefix: string
  /** Minutes since midnight if the grid is for today, else -1 (see currentMinutesFor) */
  currentMinutes: number
  /** A1Padel wraps the court name in a <span> next to extra text — read only that span */
  nameFromSpan?: boolean
}

/**
 * The legend's price tiers: colour → € per hour. Two markups exist:
 *   current: <div class="legend-item"><span style="background-color: #8dd8f8"></span> 28 €</div>
 *   older (DELFI sporto centras):
 *     <div class="trow"><div><div class="legend" style="background-color: #b9e5fb"></div></div><div> 32.00€ </div></div>
 */
export function legendPrices($: CheerioAPI): Map<string, number> {
  const tiers = new Map<string, number>()
  const add = (style: string | undefined, text: string) => {
    const color = parseBgColor(style)
    const price = parseEuro(text)
    if (color && price !== null) tiers.set(color, price)
  }
  $('.legend-item').each((_, el) => add($(el).find('span[style]').attr('style'), $(el).text()))
  $('.trow').each((_, el) => add($(el).find('.legend[style]').attr('style'), $(el).text()))
  return tiers
}

/** Relative lightness of a #rgb / #rrggbb colour (0 = black, 1 = white) */
function lightness(hex: string): number {
  const h = hex.slice(1)
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map(i => Number.parseInt(full.slice(i, i + 2), 16) / 255)
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/**
 * Colour → € per hour for the colours free cells actually use. Some installs (Vilnius Padel
 * Arena) paint free cells in their own shades instead of the legend's; when no free cell uses a
 * legend colour and there are exactly as many shades as tiers, they pair up by lightness: the
 * lighter shade is the cheaper tier, as in the legend itself (checked 2026-11-26 against the
 * booking panel: #70d113 = €28, #379917 = €40). Otherwise an unknown colour has no price.
 */
export function cellPrices(legend: Map<string, number>, cellColors: Iterable<string>): Map<string, number> {
  const shades = [...new Set(cellColors)]
  if (shades.some(c => legend.has(c)) || shades.length === 0 || shades.length !== legend.size) return legend
  shades.sort((a, b) => lightness(b) - lightness(a))
  const prices = [...legend.values()].sort((a, b) => a - b)
  return new Map(shades.map((c, i) => [c, prices[i]!]))
}

export function parseNTennisGrid(html: string, opts: NTennisGridOptions): Court[] {
  const $ = load(html)

  const slotTimes: string[] = []
  $('thead th').each((_, el) => { slotTimes.push(...expandHourHeader($(el).text())) })

  type Cell = { time: string; free: boolean; color: string | null }
  const rows: { name: string; cells: Cell[] }[] = []
  $('tr').each((_, row) => {
    const sticky = $(row).find('td.rbt-sticky-col, th.rbt-sticky-col')
    // Older installs (e.g. DELFI sporto centras) put the court name in a plain first cell
    const nameEl = sticky.length
      ? sticky
      : $(row).children('td').first().filter((_, el) => !($(el).attr('class') ?? '').includes('booking-slot'))
    const name = (opts.nameFromSpan && nameEl.find('span').first().text().trim()) || nameEl.text().trim()
    if (!name) return

    const cells: Cell[] = []
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
      cells.push({ time, free: isAvailable, color: parseBgColor($(cell).attr('style')) })
    })
    if (cells.length > 0) rows.push({ name, cells })
  })

  const freeColors = rows.flatMap(r => r.cells.filter(c => c.free && c.color).map(c => c.color!))
  const perHour = cellPrices(legendPrices($), freeColors)

  return rows.map(({ name, cells }) => ({
    id: `${opts.idPrefix}-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    type: courtTypeFromName(name),
    slots: toSlots(cells.map(c => ({ time: c.time, free: c.free, price: c.color ? perHalfHour(perHour.get(c.color)) : null })), opts.currentMinutes),
  }))
}
