import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractInputValue, fetchNTennisGrid, LOGIN_REJECTED, loginAndFetchGrid } from '../../server/utils/ntennis-fetch'

describe('runtime portability (shared with the Cloudflare Worker)', () => {
  const read = (f: string) => readFileSync(fileURLToPath(new URL(`../../server/utils/${f}`, import.meta.url)), 'utf8')

  // Cheap early warning; the CI "cf-proxy" typecheck + bundle steps are the authoritative check
  it.each(['ntennis-fetch.ts', 'cookies.ts'])('%s imports no packages (local modules only)', file => {
    const imports = [...read(file).matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]!)
    expect(imports.filter(i => !i.startsWith('./'))).toEqual([])
  })

  it('ntennis-fetch.ts uses no Nitro auto-imports', () => {
    expect(read('ntennis-fetch.ts')).not.toMatch(/\$fetch|useRuntimeConfig|defineEventHandler|createError/)
  })
})

const LOGIN_PAGE = `
  <form id="login-form">
    <input name="YII_CSRF_TOKEN" type="hidden" value="csrf123">
    <input type="text" name="LoginForm[var_login]" value="typed-user">
  </form>
  <form id="guest">
    <input value="guestUser" name="LoginForm[var_login]" type="hidden">
    <input type='hidden' name='LoginForm[var_password]' value='guestPass'>
  </form>`

const GRID = '<table><tr><td class="rbt-sticky-col">Kortas 1</td><td class="booking-slot booking-slot-available"></td></tr></table>'

describe('extractInputValue', () => {
  it('reads values regardless of attribute order or quote style', () => {
    expect(extractInputValue(LOGIN_PAGE, 'YII_CSRF_TOKEN')).toBe('csrf123')
    expect(extractInputValue(LOGIN_PAGE, 'LoginForm[var_password]')).toBe('guestPass')
  })

  it('can skip visible inputs and take the hidden guest credential', () => {
    expect(extractInputValue(LOGIN_PAGE, 'LoginForm[var_login]')).toBe('typed-user')
    expect(extractInputValue(LOGIN_PAGE, 'LoginForm[var_login]', true)).toBe('guestUser')
  })

  it('ignores look-alike attributes and keeps apostrophes inside double quotes', () => {
    expect(extractInputValue(`<input data-value="nope" name="p" value="it's">`, 'p')).toBe("it's")
    expect(extractInputValue('<input name="p" data-value="nope">', 'p')).toBeUndefined()
    expect(extractInputValue('<input data-name="p" name="q" value="v">', 'p')).toBeUndefined()
  })

  it('decodes HTML entities like cheerio did', () => {
    expect(extractInputValue('<input name="p" value="a&amp;b&#39;c&#x21;">', 'p')).toBe("a&b'c!")
  })

  it('handles unquoted attributes', () => {
    expect(extractInputValue('<input type=hidden name=tok value=abc123>', 'tok', true)).toBe('abc123')
  })

  it('returns undefined when absent', () => {
    expect(extractInputValue('<input name="x" value="">', 'x')).toBeUndefined()
    expect(extractInputValue('', 'LoginForm[var_login]')).toBeUndefined()
  })
})

type Step = { status: number; body?: string; headers?: Record<string, string> }

/** Stub global fetch with a scripted sequence of responses; returns the recorded calls. */
function scriptFetch(steps: Step[]) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const step = steps.shift()
    if (!step) throw new Error(`unexpected fetch ${url}`)
    const headers = new Headers()
    for (const [k, v] of Object.entries(step.headers ?? {})) headers.append(k, v)
    return new Response(step.body ?? '', { status: step.status, headers })
  }))
  return calls
}

const site = { baseUrl: 'https://club.test', placeId: 4 }

describe('loginAndFetchGrid', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('logs in with page-provided guest creds, carries cookies, follows the redirect, fetches the grid', async () => {
    const calls = scriptFetch([
      { status: 200, body: LOGIN_PAGE, headers: { 'set-cookie': 'PHPSESSID=s1; path=/' } },
      { status: 302, headers: { location: '/site/index', 'set-cookie': 'auth=a1; path=/' } },
      { status: 200 },
      { status: 200, body: GRID },
    ])

    const result = await loginAndFetchGrid({ ...site, fallbackGuest: { login: 'fb', password: 'fb' } }, '2026-11-26')

    expect(result).toEqual({ html: GRID, status: 200, loginStatus: 302, loginRejected: false })
    expect(calls.map(c => c.url)).toEqual([
      'https://club.test/user/login',
      'https://club.test/user/login',
      'https://club.test/site/index',
      'https://club.test/reservation/short?iPlaceId=4&sDate=2026-11-26',
    ])
    const post = new URLSearchParams(calls[1]!.init.body as string)
    expect(post.get('LoginForm[var_login]')).toBe('guestUser')
    expect(post.get('LoginForm[var_password]')).toBe('guestPass')
    expect(post.get('YII_CSRF_TOKEN')).toBe('csrf123')
    const gridHeaders = calls[3]!.init.headers as Record<string, string>
    expect(gridHeaders.Cookie).toBe('PHPSESSID=s1; auth=a1')
    expect(calls.every(c => c.init.redirect === 'manual' && c.init.signal)).toBe(true)
  })

  it('falls back to configured creds when the page has none, and reports a rejected login', async () => {
    const calls = scriptFetch([
      { status: 200, body: '<form></form>' },
      { status: 200, body: 'LoginForm error' },
    ])

    const result = await loginAndFetchGrid({ ...site, fallbackGuest: { login: 'fbUser', password: 'fbPass' } }, '2026-11-26')

    expect(new URLSearchParams(calls[1]!.init.body as string).get('LoginForm[var_login]')).toBe('fbUser')
    expect(result).toEqual({ html: '', status: 200, loginStatus: 200, loginRejected: true })
    expect(calls).toHaveLength(2) // stops before a pointless grid request
  })
})

describe('fetchNTennisGrid', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns usable grid HTML', async () => {
    scriptFetch([{ status: 200, body: LOGIN_PAGE }, { status: 302 }, { status: 200, body: GRID }])
    await expect(fetchNTennisGrid(site, '2026-11-26')).resolves.toBe(GRID)
  })

  it('throws a descriptive error when login is rejected', async () => {
    scriptFetch([{ status: 200, body: LOGIN_PAGE }, { status: 200 }])
    await expect(fetchNTennisGrid(site, '2026-11-26')).rejects.toThrow(LOGIN_REJECTED)
  })

  it('reports a grid HTTP error without blaming the session', async () => {
    scriptFetch([{ status: 200, body: LOGIN_PAGE }, { status: 302 }, { status: 404 }])
    await expect(fetchNTennisGrid(site, '2026-11-26')).rejects.toThrow(/^Grid HTTP 404$/)
  })

  it('throws when the grid is a Cloudflare challenge', async () => {
    scriptFetch([{ status: 200, body: LOGIN_PAGE }, { status: 302 }, { status: 200, body: '<title>Just a moment...</title>' }])
    await expect(fetchNTennisGrid(site, '2026-11-26')).rejects.toThrow('Cloudflare challenge')
  })
})
