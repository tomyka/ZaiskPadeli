import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { vi } from 'vitest'

/** A saved upstream response from tests/fixtures */
export const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../../fixtures/${name}`, import.meta.url)), 'utf8')

type Route = Response | unknown | ((url: string, init?: RequestInit) => Response)

/**
 * Stand-in for the network at the scrapers' one seam, global fetch: each request goes to
 * the first route whose key is a substring of its URL. A plain value answers as JSON.
 * Unrouted requests fail the test. Returns the URLs requested, in order.
 */
export function routeFetch(routes: Record<string, Route>): string[] {
  const seen: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    seen.push(url)
    const key = Object.keys(routes).find(k => url.includes(k))
    if (key === undefined) throw new Error(`Unrouted fetch: ${url}`)
    const route = routes[key]
    if (typeof route === 'function') return (route as (u: string, i?: RequestInit) => Response)(url, init)
    if (route instanceof Response) return route.clone()
    return Response.json(route)
  }))
  return seen
}
