<template>
  <div class="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">

    <!-- ═══ DATE ═══ -->
    <nav class="mb-3 flex items-center gap-2" aria-label="Datos pasirinkimas">
      <div class="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
        <button v-for="day in quickDays" :key="day.date" type="button"
          :aria-pressed="selectedDate === day.date"
          @click="selectedDate = day.date"
          :class="[
            'flex h-[52px] min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 transition-colors duration-200',
            selectedDate === day.date
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'border border-gray-200 bg-white text-gray-700 hover:border-emerald-300'
          ]">
          <span class="text-[11px] font-medium"
            :class="selectedDate === day.date ? 'text-emerald-100' : 'text-gray-500'">{{ day.label }}</span>
          <span class="text-[17px] font-bold leading-tight tabular-nums">{{ day.day }}</span>
        </button>
      </div>
      <!-- Calendar picker for dates beyond 7 days -->
      <label class="relative shrink-0 cursor-pointer" title="Pasirinkti datą">
        <span class="sr-only">Pasirinkti kitą datą</span>
        <input type="date" v-model="selectedDate" :min="today" :max="maxDate"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span :class="['flex h-[52px] items-center justify-center rounded-xl border bg-white transition-colors duration-200',
          isCustomDate
            ? 'gap-1.5 border-emerald-500 px-3 text-emerald-700'
            : 'w-12 border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700']">
          <svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
          </svg>
          <span v-if="isCustomDate" class="text-xs font-semibold tabular-nums">{{ selectedDate.slice(5) }}</span>
        </span>
      </label>
    </nav>

    <!-- ═══ DURATION + START TIME ═══ -->
    <div class="mb-3 flex items-center gap-1.5" role="group" aria-label="Žaidimo trukmė">
      <button v-for="d in DURATIONS" :key="d" type="button" :aria-pressed="duration === d"
        @click="duration = d"
        :class="['h-11 shrink-0 rounded-full border px-3.5 text-sm transition-colors',
          duration === d
            ? 'border-emerald-600 bg-emerald-600 font-semibold text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:border-emerald-300']">
        {{ d }} min
      </button>
      <label class="relative ml-auto flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm"
        :class="fromTime ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-400 bg-white text-gray-700'">
        <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <span class="sr-only">Pradžios laikas</span>
        <select v-model="fromTime" class="min-w-0 appearance-none bg-transparent pr-1 font-medium focus:outline-none">
          <option value="">Bet kada</option>
          <option v-for="t in view.startTimeOptions" :key="t" :value="t">nuo {{ t }}</option>
        </select>
      </label>
    </div>

    <!-- ═══ CITY + MORE FILTERS ═══ -->
    <div class="mb-4 flex items-center gap-1.5">
      <label class="relative flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white pl-3 pr-2 text-sm text-gray-800">
        <svg class="h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <span class="sr-only">Miestas</span>
        <select v-model="selectedCity" class="min-w-0 appearance-none bg-transparent pr-5 font-medium focus:outline-none">
          <option :value="null">Visi miestai</option>
          <option v-for="city in CITIES" :key="city" :value="city">
            {{ city }}{{ ACTIVE_CITIES.has(city) ? '' : ' (greitai)' }}
          </option>
        </select>
        <svg class="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </label>
      <button type="button" @click="detectCity" :disabled="gpsState === 'loading'"
        :aria-label="gpsState === 'error' ? 'Vieta neprieinama' : 'Nustatyti miestą pagal mano vietą'"
        :title="gpsState === 'error' ? 'GPS neprieinamas' : 'Mano vieta'"
        :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white transition',
          gpsState === 'error' ? 'border-red-200 text-red-500' : 'border-gray-300 text-gray-600 hover:border-emerald-300 hover:text-emerald-700']">
        <svg v-if="gpsState === 'loading'" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" /><path stroke-linecap="round" d="M12 2.75v3M12 18.25v3M2.75 12h3M18.25 12h3" />
        </svg>
      </button>
      <button type="button" @click="filtersOpen = true"
        :class="['ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition',
          extraFilterCount ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-300 bg-white text-gray-700 hover:border-emerald-300']">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filtrai<span v-if="extraFilterCount" class="tabular-nums"> · {{ extraFilterCount }}</span>
      </button>
    </div>

    <!-- ═══ LOADING ═══ -->
    <div v-if="pending" class="flex flex-col items-center justify-center py-24">
      <div class="relative">
        <div class="h-12 w-12 rounded-full border-[3px] border-emerald-100"></div>
        <div class="absolute inset-0 h-12 w-12 animate-spin rounded-full border-[3px] border-transparent border-t-emerald-500"></div>
      </div>
      <p class="mt-4 text-sm font-medium text-gray-500">Ieškoma laisvų aikštelių...</p>
    </div>

    <!-- ═══ ERROR ═══ -->
    <div v-else-if="error" class="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center">
      <p class="font-medium text-red-700">Klaida kraunant duomenis</p>
      <p class="mt-1 text-sm text-red-600">Patikrinkite interneto ryšį ir bandykite dar kartą</p>
      <button type="button" @click="refresh()" class="mt-4 min-h-[44px] rounded-xl bg-red-100 px-5 text-sm font-medium text-red-700 transition hover:bg-red-200">
        Bandyti dar kartą
      </button>
    </div>

    <!-- ═══ RESULTS ═══ -->
    <div v-else>
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-sm text-gray-600">
          <b class="text-gray-900 tabular-nums">{{ view.bookableCount }} {{ ltPlural(view.bookableCount, 'vieta', 'vietos', 'vietų') }}</b>
          turi laisvą {{ duration }} min{{ fromTime ? ` nuo ${fromTime}` : '' }}
        </p>
        <button type="button" @click="refresh()" aria-label="Atnaujinti"
          class="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
          <svg :class="['h-4 w-4', refreshing ? 'animate-spin' : '']" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span v-if="data" class="tabular-nums">{{ formatTime(data.fetchedAt) }}</span>
        </button>
      </div>

      <div class="space-y-3">
        <VenueCard v-for="(v, vIdx) in view.venues" :key="v.venue.id"
          class="venue-card" :style="{ animationDelay: `${vIdx * 50}ms` }"
          :venue="v.venue" :courts="v.courts" :sessions="v.sessions" :strip="v.strip"
          :duration="duration" :expanded="expanded.has(v.venue.id)"
          @toggle="toggleVenue(v.venue.id)"
          @pick="time => openSession(v.venue.id, time)" />
      </div>

      <!-- No results at all -->
      <div v-if="view.venues.length === 0" class="py-16 text-center">
        <p class="font-medium text-gray-600">
          <template v-if="selectedCity && !ACTIVE_CITIES.has(selectedCity)">
            {{ selectedCity }} mieste kortų duomenys kol kas neprieinami
          </template>
          <template v-else>Nėra laisvų {{ duration }} min laikų pagal pasirinktus filtrus</template>
        </p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <button v-if="duration !== DURATIONS[0]" type="button" @click="duration = DURATIONS[0]"
            class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
            Bandyti {{ DURATIONS[0] }} min
          </button>
          <button type="button" @click="clearFilters"
            class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50">
            Išvalyti filtrus
          </button>
        </div>
      </div>

      <!-- Ad unit — shown after users have seen the value -->
      <div class="mt-6 flex justify-center">
        <ins class="adsbygoogle"
          style="display:block"
          data-ad-client="ca-pub-7290396604686794"
          data-ad-slot="auto"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
      </div>

      <!-- Data freshness indicator -->
      <p v-if="data" class="mt-6 text-center text-[11px] text-gray-500">
        {{ data.fromCache ? `Talpykla · prieš ${data.cacheAgeSeconds}s` : 'Atnaujinta' }} · {{ formatTime(data.fetchedAt) }}
      </p>
    </div>

    <!-- ═══ SESSION SHEET ═══ -->
    <BottomSheet :open="!!sheet" :title="shownSheet ? `${shownSheet.venue.name}, ${shownSheet.start.time}` : ''" @close="sheetKey = null">
      <template v-if="shownSheet" #header>
        <p class="text-[13px] text-gray-600">{{ shownSheet.venue.name }} · {{ selectedDayLabel }}</p>
        <h2 class="text-[26px] font-bold tabular-nums text-gray-900">{{ shownSheet.start.time }} – {{ sessionEnd(shownSheet.start.time, duration) }}</h2>
        <p class="text-sm text-gray-600">
          {{ duration }} min · {{ shownSheet.start.courts.length }} {{ ltPlural(shownSheet.start.courts.length, 'laisvas kortas', 'laisvi kortai', 'laisvų kortų') }}
        </p>
      </template>
      <template v-if="shownSheet">
        <ul class="space-y-2.5">
          <li v-for="c in shownSheet.start.courts" :key="c.court.id"
            class="flex items-center gap-3 rounded-2xl border border-gray-200 px-3.5 py-3">
            <div class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-semibold text-gray-900">{{ c.court.name }}</span>
              <span class="mt-0.5 flex items-center gap-2"><CourtTags :court="c.court" /></span>
            </div>
            <span v-if="c.price !== null" class="text-[17px] font-bold tabular-nums text-gray-900">{{ formatPrice(c.price) }}</span>
            <a :href="shownSheet.venue.bookingUrl" target="_blank" rel="noopener"
              class="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97]">
              Rezervuoti
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </a>
          </li>
        </ul>
        <p class="mt-4 text-xs leading-relaxed text-gray-600">
          Rezervacija vyksta klubo svetainėje. Kaina už visą {{ duration }} min laiką pagal klubo kainoraštį ir gali skirtis.
        </p>
        <div v-if="shownSheet.others.length" class="mt-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Kiti laikai</p>
          <div class="grid grid-cols-4 gap-1.5">
            <button v-for="s in shownSheet.others" :key="s.time" type="button"
              class="h-11 rounded-xl border border-gray-300 bg-white text-sm tabular-nums text-gray-800 transition hover:border-emerald-300"
              @click="openSession(shownSheet.venue.id, s.time)">
              {{ s.time }}
            </button>
          </div>
        </div>
      </template>
    </BottomSheet>

    <!-- ═══ FILTER SHEET ═══ -->
    <BottomSheet :open="filtersOpen" title="Filtrai" @close="filtersOpen = false">
      <fieldset class="mb-5">
        <legend class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Kortas</legend>
        <div class="grid grid-cols-3 overflow-hidden rounded-xl border border-gray-300">
          <button v-for="o in TYPE_OPTIONS" :key="String(o.value)" type="button" :aria-pressed="filterType === o.value"
            @click="filterType = o.value"
            :class="['h-11 text-sm', filterType === o.value ? 'bg-emerald-600 font-semibold text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">
            {{ o.label }}
          </button>
        </div>
      </fieldset>
      <fieldset class="mb-6">
        <legend class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Vieta</legend>
        <div class="grid grid-cols-3 overflow-hidden rounded-xl border border-gray-300">
          <button v-for="o in INDOOR_OPTIONS" :key="String(o.value)" type="button" :aria-pressed="filterIndoor === o.value"
            @click="filterIndoor = o.value"
            :class="['h-11 text-sm', filterIndoor === o.value ? 'bg-emerald-600 font-semibold text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">
            {{ o.label }}
          </button>
        </div>
      </fieldset>
      <div class="flex gap-2">
        <button type="button" @click="clearFilters"
          class="h-12 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Išvalyti
        </button>
        <button type="button" @click="filtersOpen = false"
          class="h-12 flex-1 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white hover:bg-emerald-700">
          Rodyti {{ view.bookableCount }} {{ ltPlural(view.bookableCount, 'vietą', 'vietas', 'vietų') }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup lang="ts">
import type { AvailabilityResponse } from '~~/server/utils/types'
import { CITIES } from '~~/server/utils/types'
import { ACTIVE_CITIES } from '~~/server/utils/venues'
import { MAX_DAYS_AHEAD, addDays, currentMinutesFor, dayOfWeek, todayLT } from '~~/server/utils/time'
import { buildAvailabilityView, nearestCity, resolveSession, type CourtKind, type SessionSheet } from '~/utils/availability'
import { DURATIONS } from '~/utils/prefs'
import { formatPrice, ltPlural } from '~/utils/format'
import { sessionEnd } from '~/utils/sessions'

// Remembered across visits (cookie): city, duration, court type, indoor
const { city: selectedCity, duration, type: filterType, indoor: filterIndoor, clearCourtFilters } = usePrefs()

const TYPE_OPTIONS: { value: CourtKind | null; label: string }[] = [
  { value: null, label: 'Visi' }, { value: 'doubles', label: '2v2' }, { value: 'singles', label: '1v1' },
]
const INDOOR_OPTIONS: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Visi' }, { value: true, label: 'Vidaus' }, { value: false, label: 'Lauko' },
]

// Re-read every minute so today's past starts drop off and the date pills roll over at midnight
const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  tickTimer = setInterval(() => { nowTick.value = Date.now() }, 60_000)
  // Initialize AdSense ad units after mount
  try {
    const w = window as any
    ;(w.adsbygoogle = w.adsbygoogle || []).push({})
  } catch {}
})
onBeforeUnmount(() => clearInterval(tickTimer))

const today = computed(() => todayLT(new Date(nowTick.value)))
const maxDate = computed(() => addDays(today.value, MAX_DAYS_AHEAD))
const selectedDate = ref(todayLT())
// Page left open past midnight: if "today" was selected, follow it to the new day
watch(today, (now, before) => { if (selectedDate.value === before) selectedDate.value = now })
const fromTime = ref('')
const filtersOpen = ref(false)
const expanded = ref(new Set<string>())
/** The session whose sheet is open */
const sheetKey = ref<{ venueId: string; time: string } | null>(null)
const gpsState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const refreshing = ref(false)

// 7-day quick navigation pills
const LT_DAYS = ['Sek', 'Pir', 'Ant', 'Tre', 'Ket', 'Pen', 'Šeš']
const quickDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today.value, i)
    const label = i === 0 ? 'Šiandien' : i === 1 ? 'Rytoj' : LT_DAYS[dayOfWeek(date)]
    return { date, label, day: Number(date.slice(8)) }
  })
)

// True when user picked a date beyond the 7-day quick nav
const isCustomDate = computed(() => !quickDays.value.some(d => d.date === selectedDate.value))

const selectedDayLabel = computed(() =>
  quickDays.value.find(d => d.date === selectedDate.value)?.label ?? selectedDate.value
)

watch(selectedDate, () => { expanded.value = new Set(); sheetKey.value = null })
watch(selectedCity, () => { expanded.value = new Set() })

const { data, pending, error, refresh: rawRefresh } = useFetch<AvailabilityResponse>('/api/availability', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

async function refresh() {
  refreshing.value = true
  try { await rawRefresh() } finally { refreshing.value = false }
}

const view = computed(() => buildAvailabilityView(
  data.value?.venues ?? [],
  {
    city: selectedCity.value,
    duration: duration.value,
    type: filterType.value,
    indoor: filterIndoor.value,
    fromTime: fromTime.value,
  },
  currentMinutesFor(selectedDate.value, new Date(nowTick.value)),
))

const extraFilterCount = computed(() => (filterType.value ? 1 : 0) + (filterIndoor.value !== null ? 1 : 0))

function toggleVenue(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// ── Session sheet ──
function openSession(venueId: string, time: string) {
  sheetKey.value = { venueId, time }
}

/** Resolved from live data, so it closes itself if a refresh removes the session */
const sheet = computed(() => sheetKey.value && resolveSession(view.value, sheetKey.value.venueId, sheetKey.value.time))

/** Last open sheet, kept after closing so the content doesn't blank out during the leave transition */
const shownSheet = shallowRef<SessionSheet | null>(null)
watch(sheet, (s) => { if (s) shownSheet.value = s })

function clearFilters() {
  fromTime.value = ''
  clearCourtFilters()
}

function detectCity() {
  if (!navigator.geolocation) { gpsState.value = 'error'; return }
  gpsState.value = 'loading'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      selectedCity.value = nearestCity(pos.coords.latitude, pos.coords.longitude)
      gpsState.value = 'done'
    },
    () => { gpsState.value = 'error' },
    { timeout: 8000 }
  )
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

useHead({ title: 'Žaisk Padelį — Laisvos aikštelės' })
</script>
