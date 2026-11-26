import { extractSetCookies } from './cookies'

/**
 * GO Padel (Alytus) day fetch: the club's public API, used the way its booking page does.
 *   POST /session                                   → anonymous visitor session cookie
 *   GET  /facilities                                → courts (id, name)
 *   GET  /facilities/1/availability?date=YYYY-MM-DD → per court, half-hour slots
 *
 * RUNTIME-AGNOSTIC: imported by the Nitro server AND bundled into the Cloudflare Worker
 * (cf-proxy/src/worker.ts), because api.gopadel.lt sits behind Cloudflare, which refuses
 * Vercel's datacenter IPs. Web-standard APIs only; no Node built-ins, no Nitro auto-imports.
 */

const API = 'https://api.gopadel.lt'
export const GOPADEL_FACILITY_ID = 1
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface GoPadelFacility {
  id: number
  courts: { id: number; name: string }[]
}

export interface GoPadelAvailability {
  courts: { courtId: number; slots: { start: string; status: string; pricePerHour: number | null }[] }[]
}

export interface GoPadelDay {
  facility: GoPadelFacility
  availability: GoPadelAvailability
}

interface Envelope<T> { success: boolean; message?: string | null; data: T }

export async function fetchGoPadelDay(date: string): Promise<GoPadelDay> {
  const session = await fetch(`${API}/session`, { method: 'POST', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) })
  if (!session.ok) throw new Error(`Session HTTP ${session.status}`)
  const cookie = extractSetCookies(session.headers).join('; ')

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Cookie': cookie },
      signal: AbortSignal.timeout(10_000),
    })
    // A Cloudflare challenge is HTML, not JSON: report the HTTP status, not a parse error
    let body: Envelope<T> | undefined
    try { body = (await res.json()) as Envelope<T> } catch { body = undefined }
    if (!res.ok || !body?.success) throw new Error(`${path}: HTTP ${res.status} ${body?.message ?? ''}`.trim())
    return body.data
  }

  const [facilities, availability] = await Promise.all([
    get<GoPadelFacility[]>('/facilities'),
    get<GoPadelAvailability>(`/facilities/${GOPADEL_FACILITY_ID}/availability?date=${date}`),
  ])
  const facility = facilities.find(f => f.id === GOPADEL_FACILITY_ID)
  if (!facility) throw new Error('Padel facility not found')
  return { facility, availability }
}
