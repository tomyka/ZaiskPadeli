<template>
  <div class="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:flex lg:max-w-[100rem] lg:items-start lg:gap-6 lg:px-8">

    <!-- ═══ CONTROLS: stacked rows on phones, a sticky sidebar on desktop ═══ -->
    <aside aria-label="Paieška"
      class="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-64 lg:shrink-0 lg:-m-1.5 lg:overflow-y-auto lg:p-1.5 lg:pb-4">

      <!-- Date -->
      <p class="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-gray-600 lg:block">Data</p>
      <nav class="mb-3 flex items-center gap-2 lg:mb-5 lg:grid lg:grid-cols-4 lg:gap-1.5" aria-label="Datos pasirinkimas">
        <div class="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar lg:contents">
          <button v-for="day in quickDays" :key="day.date" type="button"
            :aria-pressed="selectedDate === day.date"
            @click="selectedDate = day.date"
            :class="[
              'flex h-[52px] min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl px-2.5 transition-colors duration-200 lg:min-w-0 lg:px-0',
              selectedDate === day.date
                ? 'bg-ink text-ball shadow-md shadow-ink/20'
                : 'border border-court-line bg-white text-ink hover:border-ink/40'
            ]">
            <span class="text-[11px] font-medium"
              :class="selectedDate === day.date ? 'text-ink-muted' : 'text-gray-600'">{{ day.label }}</span>
            <span class="font-display text-[22px] font-bold leading-none tabular-nums">{{ day.day }}</span>
          </button>
        </div>
        <!-- Calendar picker for dates beyond 7 days -->
        <label class="relative shrink-0 cursor-pointer rounded-xl focus-within:ring-[3px] focus-within:ring-ball-deep focus-within:ring-offset-2" title="Pasirinkti datą">
          <span class="sr-only">Pasirinkti kitą datą</span>
          <input type="date" :value="selectedDate" :min="today" :max="maxDate" @change="pickDate" @blur="resetDateInput"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          <span :class="['flex h-[52px] items-center justify-center rounded-xl border bg-white transition-colors duration-200 lg:w-full lg:px-0',
            isCustomDate
              ? 'gap-1.5 border-ink px-3 text-ink'
              : 'w-12 border-court-line text-gray-600 hover:border-ink/40 hover:text-ink']">
            <svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
            </svg>
            <span v-if="isCustomDate" class="text-xs font-semibold tabular-nums">{{ selectedDate.slice(5) }}</span>
          </span>
        </label>
      </nav>

      <!-- Duration + start time -->
      <p class="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-gray-600 lg:block">Trukmė ir laikas</p>
      <div class="mb-3 flex items-center gap-1.5 lg:mb-5 lg:flex-wrap" role="group" aria-label="Žaidimo trukmė">
        <button v-for="d in DURATIONS" :key="d" type="button" :aria-pressed="duration === d"
          @click="duration = d"
          :class="['h-11 shrink-0 rounded-full border px-3.5 text-sm transition-colors lg:flex-1 lg:px-0',
            duration === d
              ? 'border-ink bg-ink font-semibold text-ball'
              : 'border-court-line bg-white text-ink hover:border-ink/40']">
          {{ d }} min
        </button>
        <SelectMenu v-model="fromTime" label="Pradžios laikas" :options="startTimeChoices" :active="!!fromTime" dashed compact
          class="ml-auto min-w-0 lg:ml-0 lg:w-full">
          <template #icon>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </template>
        </SelectMenu>
      </div>

      <!-- County (+ more filters on phones), then its municipalities when it has several -->
      <p class="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-gray-600 lg:block">Apskritis</p>
      <div class="mb-4 flex items-center gap-1.5 lg:mb-5">
        <SelectMenu v-model="county" label="Apskritis" :options="COUNTY_OPTIONS" :active="county !== null" class="min-w-0 lg:flex-1">
          <template #icon>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </template>
        </SelectMenu>
        <button type="button" @click="detectCounty" :disabled="gpsState === 'loading'"
          :aria-label="gpsState === 'error' ? 'Vieta neprieinama' : 'Nustatyti apskritį pagal mano vietą'"
          :title="gpsState === 'error' ? 'GPS neprieinamas' : 'Mano vieta'"
          :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white transition',
            gpsState === 'error' ? 'border-red-200 text-red-500' : 'border-court-line text-gray-600 hover:border-ink/40 hover:text-ink']">
          <svg v-if="gpsState === 'loading'" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5" /><path stroke-linecap="round" d="M12 2.75v3M12 18.25v3M2.75 12h3M18.25 12h3" />
          </svg>
        </button>
        <button type="button" @click="filtersOpen = true"
          :class="['ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition lg:hidden',
            extraFilterCount ? 'border-ink bg-ink text-ball' : 'border-court-line bg-white text-ink hover:border-ink/40']">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtrai<span v-if="extraFilterCount" class="tabular-nums"> · {{ extraFilterCount }}</span>
        </button>
      </div>

      <div v-if="choices.municipalities.length" role="group" aria-label="Savivaldybė"
        class="-mt-2 mb-4 flex flex-wrap gap-1.5 lg:-mt-3 lg:mb-5">
        <button v-for="m in [null, ...choices.municipalities]" :key="m ?? 'all'" type="button"
          :aria-pressed="location.municipality === m" @click="location = chooseMunicipality(location, m)"
          :class="['h-11 rounded-full border px-3.5 text-sm transition',
            location.municipality === m ? 'border-ink bg-ink font-semibold text-ball' : 'border-court-line bg-white text-ink hover:border-ink/40']">
          {{ m ?? 'Visa apskritis' }}
        </button>
      </div>

      <!-- Court filters: always visible on desktop, in a sheet on phones -->
      <div class="hidden space-y-5 lg:block">
        <CourtFilters v-model:type="filterType" v-model:indoor="filterIndoor" />
        <button type="button" @click="clearFilters"
          class="min-h-[44px] text-sm font-semibold text-ball-text hover:text-ball-deep">
          Išvalyti filtrus
        </button>
      </div>
    </aside>

    <!-- ═══ RESULTS ═══ -->
    <div class="min-w-0 lg:flex-1">
      <div v-if="pending" class="flex flex-col items-center justify-center py-24">
        <!-- Loading (#51, "Atšokimas"): a court from above, the ball bouncing along a Z off the glass -->
        <svg viewBox="0 0 200 200" class="h-20 w-20" aria-hidden="true">
          <rect x="26" y="40" width="148" height="120" rx="14" fill="none" class="stroke-court-line" stroke-width="6"/>
          <line x1="100" y1="40" x2="100" y2="160" class="stroke-court-line" stroke-width="3" stroke-dasharray="6 7"/>
          <path d="M46 66 H160 L46 134 H154" fill="none" class="stroke-ball" stroke-opacity="0.35" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
          <circle r="15" class="fill-ball motion-reduce:hidden">
            <animateMotion dur="1.6s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear" path="M46 66 H160 L46 134 H154"/>
          </circle>
          <circle cx="154" cy="134" r="15" class="hidden fill-ball motion-reduce:inline"/>
        </svg>
        <p class="mt-4 text-sm font-medium text-gray-600">Ieškoma laisvų aikštelių...</p>
      </div>

      <div v-else-if="error" class="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center">
        <p class="font-medium text-red-700">Klaida kraunant duomenis</p>
        <p class="mt-1 text-sm text-red-600">Patikrinkite interneto ryšį ir bandykite dar kartą</p>
        <button type="button" @click="refresh()" class="mt-4 min-h-[44px] rounded-xl bg-red-100 px-5 text-sm font-medium text-red-700 transition hover:bg-red-200">
          Bandyti dar kartą
        </button>
      </div>

      <template v-else>
        <!-- Installed app without a network: the data is the last copy loaded (its time is shown) -->
        <p v-if="!online" role="status"
          class="mb-3 rounded-xl border border-court-line bg-white px-3.5 py-2.5 text-sm text-gray-600">
          <b class="text-ink">Nėra interneto ryšio.</b> Rodomi paskutiniai įkelti duomenys.
        </p>
        <div class="mb-3 flex items-center justify-between gap-2">
          <p class="text-sm text-gray-600 lg:text-[15px]">
            <b class="text-gray-900 tabular-nums">{{ view.bookableCount }} {{ ltPlural(view.bookableCount, 'vieta', 'vietos', 'vietų') }}</b>
            turi laisvą {{ duration }} min{{ fromTime ? ` nuo ${fromTime}` : '' }}<span class="hidden lg:inline"> · {{ selectedDayLabel }}</span>
          </p>
          <button type="button" @click="refresh()" aria-label="Atnaujinti"
            class="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs text-gray-600 transition hover:bg-gray-100 hover:text-gray-700">
            <svg :class="['h-4 w-4', refreshing ? 'animate-spin' : '']" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span v-if="data" class="tabular-nums">{{ formatUpdated(data.fetchedAt, today) }}</span>
          </button>
        </div>

        <!-- Cards: one column on phones; two on desktop, three on very wide screens (an expanded card grows in
             place so it never jumps away from the pointer). While the session panel
             takes ~22rem, step down one column so time chips keep their size -->
        <div :class="['grid items-start gap-3', panelSession ? 'min-[1700px]:grid-cols-2' : 'lg:grid-cols-2 min-[1700px]:grid-cols-3']">
          <VenueCard v-for="(v, vIdx) in view.venues" :key="v.venue.id" :show-municipality="view.showMunicipality"
            class="venue-card"
            :style="{ animationDelay: `${vIdx * 50}ms` }"
            :venue="v.venue" :courts="v.courts" :sessions="v.sessions" :strip="v.strip"
            :duration="duration" :expanded="expanded.has(v.venue.id)"
            :selected-time="panelSession?.venue.id === v.venue.id ? panelSession.start.time : null"
            @toggle="toggleVenue(v.venue.id)"
            @pick="time => openSession(v.venue.id, time)" />
        </div>

        <!-- No results at all -->
        <div v-if="view.venues.length === 0" class="py-16 text-center">
          <template v-if="choices.noVenuesText">
            <!-- No data for this county at all: filters can't help, offer the whole country instead -->
            <p class="font-medium text-gray-600">{{ choices.noVenuesText }}</p>
            <button type="button" @click="location = EVERYWHERE"
              class="mt-4 min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-ball-text transition hover:bg-ball-tint">
              Rodyti visą Lietuvą
            </button>
          </template>
          <p v-else class="font-medium text-gray-600">Nėra laisvų {{ duration }} min laikų pagal pasirinktus filtrus</p>
          <div v-if="!choices.noVenuesText" class="mt-4 flex flex-wrap justify-center gap-2">
            <button v-if="location.municipality" type="button" @click="location = chooseMunicipality(location, null)"
              class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-ball-text transition hover:bg-ball-tint">
              Rodyti visą apskritį
            </button>
            <button v-if="duration !== DURATIONS[0]" type="button" @click="duration = DURATIONS[0]"
              class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-ball-text transition hover:bg-ball-tint">
              Bandyti {{ DURATIONS[0] }} min
            </button>
            <button type="button" @click="clearFilters"
              class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-ball-text transition hover:bg-ball-tint">
              Išvalyti filtrus
            </button>
          </div>
        </div>

        <!-- Covered venues with nothing free for these filters: listed so they don't silently vanish -->
        <section v-if="view.full.length" aria-labelledby="full-venues-title"
          class="mt-3 rounded-2xl border border-court-line bg-white px-4 py-3 lg:max-w-xl">
          <h2 id="full-venues-title" class="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Be laisvų {{ duration }} min laikų{{ fromTime ? ` nuo ${fromTime}` : '' }}
          </h2>
          <ul class="mt-1 divide-y divide-gray-100">
            <li v-for="v in view.full" :key="v.id">
              <a :href="v.bookingUrl" target="_blank" rel="noopener"
                class="flex min-h-[44px] items-center gap-3 text-sm text-gray-600 hover:text-ink">
                <span class="h-2 w-2 shrink-0 rounded-full opacity-60" :style="{ backgroundColor: venueAccent(v.id) }" aria-hidden="true"></span>
                <span class="min-w-0 flex-1 truncate"><span class="font-medium text-ink">{{ v.name }}</span> · {{ v.municipality }}<span class="sr-only"> (atsidaro naujame lange)</span></span>
                <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
            </li>
          </ul>
        </section>

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
        <p v-if="data" class="mt-6 text-center text-[11px] text-gray-600">
          Atnaujinta {{ formatUpdated(data.fetchedAt, today) }}{{ data.fromCache && data.cacheAgeSeconds ? ` (prieš ${Math.max(1, Math.round(data.cacheAgeSeconds / 60))} min)` : '' }}
        </p>
      </template>
    </div>

    <!-- ═══ SESSION PANEL (desktop) ═══ -->
    <aside v-if="panelSession" ref="panelEl" tabindex="-1" aria-label="Pasirinktas laikas"
      class="sticky top-20 max-h-[calc(100vh-6rem)] w-[22rem] shrink-0 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-lg outline-none">
      <button type="button" aria-label="Uždaryti" @click="selectedKey = null"
        class="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-700">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <SessionDetails :session="panelSession" :duration="duration" :day-label="selectedDayLabel" :date="selectedDate"
        @pick="time => switchSession(time)" />
    </aside>

    <!-- ═══ SESSION SHEET (phones) ═══ -->
    <BottomSheet ref="sessionSheetEl" :open="!!selectedSession && !isDesktop" :show-title="false"
      :title="sheetSession ? `${sheetSession.venue.name}, ${sheetSession.start.time}` : ''" @close="selectedKey = null">
      <SessionDetails v-if="sheetSession" :session="sheetSession" :duration="duration" :day-label="selectedDayLabel" :date="selectedDate"
        @pick="time => switchSession(time)" />
    </BottomSheet>

    <!-- ═══ FILTER SHEET (phones) ═══ -->
    <BottomSheet :open="filtersOpen && !isDesktop" title="Filtrai" @close="filtersOpen = false">
      <CourtFilters v-model:type="filterType" v-model:indoor="filterIndoor" class="mb-6" />
      <div class="flex gap-2">
        <!-- Clears only what this sheet sets; the start time lives outside it -->
        <button type="button" @click="clearCourtFilters"
          class="h-12 rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Išvalyti
        </button>
        <button type="button" @click="filtersOpen = false"
          class="h-12 flex-1 rounded-xl bg-ink text-[15px] font-semibold text-ball hover:bg-ink-soft">
          Rodyti {{ view.bookableCount }} {{ ltPlural(view.bookableCount, 'vietą', 'vietas', 'vietų') }}
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup lang="ts">
import type { AvailabilityResponse } from '~~/server/utils/types'
import { COUNTY_OPTIONS, EVERYWHERE, chooseCounty, chooseMunicipality, locateAt, locationChoices } from '~/utils/location'
import { MAX_DAYS_AHEAD, addDays, currentMinutesFor, dayOfWeek, isValidIsoDate, todayLT } from '~~/server/utils/time'
import { buildAvailabilityView, resolveSession, type SelectedSession } from '~/utils/availability'
import { DURATIONS } from '~/utils/prefs'
import { formatUpdated, ltPlural } from '~/utils/format'
import { venueAccent } from '~~/server/utils/venues'

// Remembered across visits (cookie): county, municipality, duration, court type, indoor
const { location, duration, type: filterType, indoor: filterIndoor, clearCourtFilters } = usePrefs()

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
/** The selected session (venue + start time), shown in the phone sheet or the desktop panel */
const selectedKey = ref<{ venueId: string; time: string } | null>(null)
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

watch(selectedDate, () => { expanded.value = new Set(); selectedKey.value = null })
watch([() => location.value.county, () => location.value.municipality], () => { expanded.value = new Set() })

/** The county select's model; picking a county goes through the location module */
const county = computed({
  get: () => location.value.county,
  set: (c) => { location.value = chooseCounty(location.value, c) },
})
const choices = computed(() => locationChoices(location.value))

/** "Bet kada" plus every start time the view offers */
const startTimeChoices = computed(() => [
  { value: '', label: 'Bet kada' },
  ...view.value.startTimeOptions.map(t => ({ value: t, label: `nuo ${t}` })),
])

const { data, pending, error, refresh: rawRefresh } = useFetch<AvailabilityResponse>('/api/availability', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

async function refresh() {
  refreshing.value = true
  try { await rawRefresh() } finally { refreshing.value = false }
}

const online = ref(true)
const setOnline = () => { online.value = navigator.onLine }
onMounted(() => {
  setOnline()
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOnline)
  // A page the installed app kept from an earlier day carries that day's data: load the selected date's
  if (data.value && data.value.date !== selectedDate.value) refresh()
})
onBeforeUnmount(() => {
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOnline)
})

const view = computed(() => buildAvailabilityView(
  data.value?.venues ?? [],
  {
    location: location.value,
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

// ── Session details: bottom sheet on phones, side panel on desktop (lg) ──
const isDesktop = useMediaQuery('(min-width: 1024px)')

function openSession(venueId: string, time: string) {
  selectedKey.value = { venueId, time }
}

/** Resolved from live data, so it closes itself if a refresh removes the session */
const selectedSession = computed<SelectedSession | null>(() =>
  selectedKey.value ? resolveSession(view.value, selectedKey.value.venueId, selectedKey.value.time) : null
)

/** Shown in the side panel; also drives the card highlight and the narrower grid */
const panelSession = computed(() => (isDesktop.value ? selectedSession.value : null))

// The filter sheet is phone-only: don't let it reappear after the window narrows again
watch(isDesktop, (desktop) => { if (desktop) filtersOpen.value = false })

// Desktop panel keyboard behaviour, matching the bottom sheet: focus moves in, Escape closes,
// focus returns to the time button that opened it
const panelEl = ref<HTMLElement | null>(null)
let panelOpener: HTMLElement | null = null
watch(() => !!panelSession.value, async (open) => {
  if (open) {
    panelOpener = document.activeElement as HTMLElement | null
    await nextTick()
    panelEl.value?.focus()
  } else {
    panelOpener?.focus()
    panelOpener = null
  }
})
function onPanelKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && panelSession.value) selectedKey.value = null
}
onMounted(() => window.addEventListener('keydown', onPanelKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onPanelKey))

/** Last selected session, kept after the sheet closes so the content doesn't blank out during the leave transition */
const sheetSession = shallowRef<SelectedSession | null>(null)
watch(selectedSession, (s) => { if (s) sheetSession.value = s })

/** Moving to another time from inside the details: its button re-renders, so keep focus in the details */
const sessionSheetEl = ref<{ focus: () => void } | null>(null)
async function switchSession(time: string) {
  if (!selectedKey.value) return
  openSession(selectedKey.value.venueId, time)
  await nextTick()
  if (panelSession.value) panelEl.value?.focus()
  else sessionSheetEl.value?.focus()
}

function clearFilters() {
  fromTime.value = ''
  clearCourtFilters()
}

/**
 * The date input fires while someone is still typing (e.g. year 0012); only accept
 * real dates inside the window the API serves, so no doomed requests or error screens.
 */
function pickDate(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (isValidIsoDate(v) && v >= today.value && v <= maxDate.value) selectedDate.value = v
}
/** Leaving the input with a half-typed date: show the date actually selected again */
function resetDateInput(e: FocusEvent) {
  (e.target as HTMLInputElement).value = selectedDate.value
}

function detectCounty() {
  if (!navigator.geolocation) { gpsState.value = 'error'; return }
  gpsState.value = 'loading'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      location.value = locateAt(location.value, pos.coords.latitude, pos.coords.longitude)
      gpsState.value = 'done'
    },
    () => { gpsState.value = 'error' },
    { timeout: 8000 }
  )
}

useHead({ title: 'Žaisk Padelį — Laisvos aikštelės' })
</script>
