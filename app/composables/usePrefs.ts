import { DEFAULT_PREFS, parsePrefs, type Prefs } from '~/utils/prefs'
import { toLocation, type Location } from '~/utils/location'

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
    /** Where the visitor is looking; any value written is normalised (see app/utils/location.ts) */
    location: computed<Location>({
      get: () => ({ county: prefs.value.county, municipality: prefs.value.municipality }),
      set: (loc) => { cookie.value = { ...prefs.value, ...toLocation(loc.county, loc.municipality) } },
    }),
    duration: field('duration'),
    type: field('type'),
    indoor: field('indoor'),
    /** Court type and indoor back to "any"; location and duration are kept */
    clearCourtFilters() {
      cookie.value = { ...prefs.value, type: null, indoor: null }
    },
  }
}
