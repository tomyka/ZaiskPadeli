import { loginAndFetchGrid, usableGridHtml, type NTennisGridResult } from './ntennis-fetch'
import { fetchGoPadelDay, type GoPadelDay } from './gopadel-fetch'

/**
 * Booking sites behind Cloudflare, which refuses Vercel's datacenter IPs: in production their
 * day is fetched by the cf-proxy Worker; in local dev, directly. Both run the same entry here.
 *
 * RUNTIME-AGNOSTIC: imported by the Nitro server (protected-fetch.ts) AND bundled into the
 * Cloudflare Worker (cf-proxy/src/worker.ts). Web-standard APIs only; no Node built-ins,
 * no Nitro auto-imports, no process.env (credentials come in through `secrets`).
 *
 * Making a site protected: add an entry below, then fetch it with fetchProtectedDay.
 */

/** Reads a credential by name: Worker secrets in the Worker, process.env on the server */
export type Secrets = (name: string) => string | undefined

export interface ProtectedSite<T> {
  /** The day's raw data, fetched from the site itself */
  fetch: (date: string, secrets: Secrets) => Promise<T>
  /** Throws a reason when the data can't be used (whether fetched here or through the Worker) */
  check: (data: T) => void
}

const site = <T>(entry: ProtectedSite<T>) => entry

/** What the Worker sends for an nTennis grid; older builds put a rejected login in `error` */
export type NTennisDay = NTennisGridResult | (Omit<NTennisGridResult, 'loginRejected'> & { error?: string })

export const PROTECTED_SITES = {
  /** Kauno Padelio Klubas (nTennis guest login) */
  kaunopadelis: site<NTennisDay>({
    fetch: (date, secrets) => {
      const login = secrets('KAUNOPADELIS_LOGIN')
      return loginAndFetchGrid({
        baseUrl: 'https://savitarna.kaunopadelis.lt',
        placeId: 1,
        fallbackGuest: login ? { login, password: secrets('KAUNOPADELIS_PASSWORD') ?? '' } : undefined,
      }, date)
    },
    check: (day) => { usableGridHtml(day) },
  }),
  /** GO Padel, Alytus (JSON API) */
  gopadel: site<GoPadelDay>({
    fetch: date => fetchGoPadelDay(date),
    check: (day) => {
      if (!day?.facility || !day?.availability) throw new Error('No GO Padel facility or availability in the response')
    },
  }),
}

export type ProtectedSiteId = keyof typeof PROTECTED_SITES
export type ProtectedDay<S extends ProtectedSiteId> = Awaited<ReturnType<(typeof PROTECTED_SITES)[S]['fetch']>>

export function isProtectedSiteId(id: string): id is ProtectedSiteId {
  return Object.hasOwn(PROTECTED_SITES, id)
}

/** A site's entry with its day type spelled out (indexing the table by a generic id loses it) */
export function protectedSite<S extends ProtectedSiteId>(id: S): ProtectedSite<ProtectedDay<S>> {
  return PROTECTED_SITES[id] as unknown as ProtectedSite<ProtectedDay<S>>
}

/** Protected sites that serve an nTennis grid */
export type NTennisProtectedSite = { [S in ProtectedSiteId]: ProtectedDay<S> extends NTennisDay ? S : never }[ProtectedSiteId]
