import { DEFAULT_PREFS, parsePrefs, type Prefs } from '~/utils/prefs'

/**
 * Remembered preferences as writable refs, backed by a cookie so the server
 * renders the same choices the visitor sees after hydration.
 */
export function usePrefs() {
  const cookie = useCookie<unknown>('zp-prefs', {
    default: () => ({ ...DEFAULT_PREFS }),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const prefs = computed(() => parsePrefs(cookie.value))

  function field<K extends keyof Prefs>(key: K) {
    return computed<Prefs[K]>({
      get: () => prefs.value[key],
      set: (v) => { cookie.value = { ...prefs.value, [key]: v } },
    })
  }

  return {
    /** Changing the county also clears the municipality, which belonged to the old one */
    county: computed<Prefs['county']>({
      get: () => prefs.value.county,
      set: (v) => { cookie.value = { ...prefs.value, county: v, municipality: null } },
    }),
    municipality: field('municipality'),
    duration: field('duration'),
    type: field('type'),
    indoor: field('indoor'),
    /** Court type and indoor back to "any"; location and duration are kept */
    clearCourtFilters() {
      cookie.value = { ...prefs.value, type: null, indoor: null }
    },
  }
}
