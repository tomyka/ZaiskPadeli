import type { CourtKind } from './types'
import { fromMinutes, toMinutes } from './time'

/**
 * Small, pure parsing helpers shared by the HTML scrapers.
 */

const EURO_RE = /(\d+(?:[.,]\d+)?)\s*€/
const BG_COLOR_RE = /background-color:\s*(#[0-9a-fA-F]{3,8})/i

/** First euro amount in a text ("12,50 €" → 12.5). Null if none. */
export function parseEuro(text: string): number | null {
  const m = EURO_RE.exec(text)
  return m?.[1] ? Number.parseFloat(m[1].replace(',', '.')) : null
}

/** Lower-cased hex background colour from an inline style attribute. */
export function parseBgColor(style: string | undefined): string | null {
  return style ? (BG_COLOR_RE.exec(style)?.[1]?.toLowerCase() ?? null) : null
}

/**
 * nTennis grids show one header per hour but two cells (kaire/desine) per hour.
 * "07:00" → ["07:00", "07:30"]. Non-clock text yields [].
 */
export function expandHourHeader(text: string): string[] {
  const t = text.trim()
  if (!/^\d{1,2}:\d{2}$/.test(t)) return []
  const start = toMinutes(t)
  return [fromMinutes(start), fromMinutes(start + 30)]
}

/** "Vienetų kortas", "5 Single SUN365", "1v1": clubs name singles courts in several ways */
export function isSinglesCourtName(name: string): boolean {
  return /vienet|single|\b1\s*v\s*1\b/i.test(name)
}

/** A court's type from its name: singles when the club names it so, else doubles */
export function courtTypeFromName(name: string): CourtKind {
  return isSinglesCourtName(name) ? 'singles' : 'doubles'
}
