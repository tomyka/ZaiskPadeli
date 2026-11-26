import { PROTECTED_SITES, type ProtectedDay, type ProtectedSiteId } from './protected-sites'

/**
 * One day of a Cloudflare-protected site (see protected-sites.ts), checked and ready to parse.
 *
 * With CF_PROXY_URL + CF_PROXY_TOKEN set (production), it goes through the cf-proxy Worker and
 * never falls back to a direct fetch: from Vercel that always fails. Without them (local dev),
 * the same site entry runs here, with credentials from process.env.
 * Throws a descriptive error on any failure, whichever way the day was fetched.
 */
export async function fetchProtectedDay<S extends ProtectedSiteId>(site: S, date: string): Promise<ProtectedDay<S>> {
  const entry = PROTECTED_SITES[site] as unknown as {
    fetch: (date: string, secrets: (name: string) => string | undefined) => Promise<ProtectedDay<S>>
    check: (day: ProtectedDay<S>) => void
  }
  const day = (await viaWorker<ProtectedDay<S>>(site, date)) ?? await entry.fetch(date, name => process.env[name])
  entry.check(day)
  return day
}

/** The Worker's answer, or null when the proxy isn't configured */
async function viaWorker<T>(site: string, date: string, timeoutMs = 20_000): Promise<T | null> {
  const proxyUrl = process.env.CF_PROXY_URL
  const proxyToken = process.env.CF_PROXY_TOKEN
  if (!proxyUrl || !proxyToken) return null

  const resp = await fetch(`${proxyUrl}?site=${encodeURIComponent(site)}&date=${date}`, {
    headers: { Authorization: `Bearer ${proxyToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resp.ok) {
    const detail = await resp.json().then((b: { error?: string }) => b.error).catch(() => undefined)
    throw new Error(`Proxy HTTP ${resp.status}${detail ? `: ${detail}` : ''}`)
  }
  return (await resp.json()) as T
}
