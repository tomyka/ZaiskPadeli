import { load } from 'cheerio'
import type { Court, TimeSlot } from './types'
import { expandHourHeader, parseBgColor, parseEuro } from './parse'
import { currentMinutesFor, isSlotOver } from './time'

/**
 * Padel House — Public HTML timetable
 * Available: <td style="background-color:#xxx" data-court="1" data-time="10:00">
 * Booked: <td class="not-available">
 * Prices derived from background-color via on-page legend (div.time-description).
 */

/** Pure parser for the Padel House timetable page (exported for tests). */
export function parsePadelHouseHtml(html: string, currentMinutes: number, idPrefix: string): Court[] {
  const $ = load(html)

  // Colour → hourly price. Current (possibly promo) price: strip .old-price first.
  const colorPrice = new Map<string, number>()
  $('div.time-description').each((_, el) => {
    const color = parseBgColor($(el).find('div.color').attr('style'))
    const priceText = $(el).find('div.description').clone().children('.old-price').remove().end().text()
    const price = parseEuro(priceText)
    if (color && price !== null) colorPrice.set(color, price)
  })

  // Use only the first (desktop) table; hour headers span two 30-min cells
  const table = $('table').first()
  const slotTimes: string[] = []
  table.find('th[colspan="2"]').each((_, el) => { slotTimes.push(...expandHourHeader($(el).text())) })

  const courtsByName = new Map<string, TimeSlot[]>()
  table.find('tr').each((_, row) => {
    const courtName = $(row).find('th.sticky-colum, td.sticky-colum').text().trim()
    if (!courtName || courtsByName.has(courtName)) return

    const slots: TimeSlot[] = []
    let slotIdx = 0
    $(row).find('td').each((_, cell) => {
      const el = $(cell)
      const classes = el.attr('class') || ''
      if (classes.includes('sticky')) return

      const time = slotTimes[slotIdx++]
      if (!time) return
      const available = !classes.includes('not-available') && !isSlotOver(time, currentMinutes)
      const color = parseBgColor(el.attr('style'))
      const hourly = color ? colorPrice.get(color) : undefined
      slots.push({ time, available, price: available && hourly !== undefined ? hourly / 2 : null })
    })

    if (slots.length > 0) courtsByName.set(courtName, slots)
  })

  return [...courtsByName].map(([name, slots], i) => ({
    id: `${idPrefix}-${i + 1}`,
    name,
    type: 'doubles',
    slots,
  }))
}

export async function scrapePadelHouse(date: string, venue: { id: string }): Promise<Court[]> {
  const html = await $fetch<string>(`https://rezervacija.padelhouse.lt/?date=${date}`, {
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PadelKaunas/1.0)' },
  })
  return parsePadelHouseHtml(html, currentMinutesFor(date), venue.id)
}
