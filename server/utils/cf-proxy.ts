/**
 * Client for the Cloudflare Worker proxy (cf-proxy/), used for venues whose sites sit
 * behind Cloudflare and refuse Vercel's datacenter IPs.
 *
 * Returns null when the proxy isn't configured (local dev): callers then fetch directly.
 * When it is configured, never fall back to a direct fetch: from Vercel that always fails.
 */
export async function fetchViaProxy<T>(site: string, date: string, timeoutMs = 20_000): Promise<T | null> {
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
