<template>
  <article :class="['overflow-hidden rounded-2xl border bg-white shadow-sm',
    selectedTime ? 'border-ball ring-1 ring-ball' : 'border-court-line']">
    <!-- Summary row: toggles the per-court view -->
    <button type="button" :aria-expanded="expanded" :disabled="!!problem"
      class="flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left disabled:cursor-default"
      @click="emit('toggle')">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: accent }" aria-hidden="true"></span>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-[20px] font-semibold leading-tight text-ink">{{ venue.name }}</span>
        <span class="block text-xs leading-snug text-gray-600">{{ meta }}</span>
      </span>
      <template v-if="!problem">
        <span class="shrink-0 text-[13px] font-bold text-ink tabular-nums">
          {{ sessions.starts.length }} {{ ltPlural(sessions.starts.length, 'laikas', 'laikai', 'laikų') }}
        </span>
        <svg :class="['h-5 w-5 shrink-0 text-gray-600 transition-transform', expanded ? 'rotate-180' : '']"
          fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </template>
      <span v-else class="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Klaida</span>
    </button>

    <p v-if="problem" class="px-4 pb-4 text-sm text-gray-600">{{ problem }}</p>

    <template v-else>
      <!-- Day availability strip -->
      <div class="px-4" role="img" :aria-label="stripLabel">
        <div class="grid h-2 gap-px overflow-hidden rounded" :style="{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }">
          <span v-for="cell in strip" :key="cell.time" :class="STRIP_CLASS[cell.state]"></span>
        </div>
        <div v-if="strip.length" class="mt-1 flex justify-between text-[11px] tabular-nums text-gray-600" aria-hidden="true">
          <span v-for="label in stripLabels" :key="label">{{ label }}</span>
        </div>
      </div>

      <!-- Collapsed: next few start times -->
      <div v-if="!expanded" class="flex gap-1.5 px-4 pb-3 pt-2.5">
        <button v-for="s in previewStarts" :key="s.time" type="button"
          :aria-current="s.time === selectedTime ? 'true' : undefined"
          :aria-label="s.label"
          :class="['flex h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center rounded-xl border transition active:scale-[0.97] lg:max-w-[5rem]',
            s.time === selectedTime ? SELECTED : IDLE]"
          @click="emit('pick', s.time)">
          <span class="font-display text-[19px] font-bold leading-none tabular-nums">{{ s.time }}</span>
          <span v-if="s.priceText" class="mt-0.5 text-[11px] font-medium leading-none"
            :class="s.time === selectedTime ? 'text-ink/70' : 'text-ink-muted'">{{ s.priceText }}</span>
        </button>
        <button v-if="sessions.starts.length > PREVIEW" type="button"
          :aria-label="moreLabel"
          class="h-[3.25rem] shrink-0 rounded-xl border border-court-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink/40"
          @click="emit('toggle')">
          +{{ sessions.starts.length - PREVIEW }}
        </button>
      </div>

      <!-- Expanded: start times per court -->
      <div v-else class="mt-2 divide-y divide-gray-100 border-t border-gray-100">
        <div v-for="{ court, starts } in courtsWithStarts" :key="court.id" class="px-4 py-3">
          <div class="mb-2 flex items-center gap-2">
            <span class="text-sm font-semibold text-ink">{{ court.name }}</span>
            <CourtTags :court="court" />
          </div>
          <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-8 lg:grid-cols-[repeat(auto-fill,4.5rem)]">
            <button v-for="s in starts" :key="s.time" type="button"
              :aria-current="s.time === selectedTime ? 'true' : undefined"
              :aria-label="[s.time, nightTag(s.time), s.price !== null ? formatPrice(s.price) : '', court.name].filter(Boolean).join(', ')"
              :class="['flex min-h-[3rem] flex-col items-center justify-center rounded-xl border transition active:scale-[0.97]',
                s.time === selectedTime ? SELECTED : IDLE]"
              @click="emit('pick', s.time)">
              <span class="font-display text-[19px] font-bold leading-none tabular-nums">{{ s.time }}</span>
              <span v-if="s.price !== null || nightTag(s.time)" class="mt-0.5 text-[11px] font-medium leading-none" :class="s.time === selectedTime ? 'text-ink/70' : 'text-ink-muted'">{{ [nightTag(s.time), s.price !== null ? formatPrice(s.price) : ''].filter(Boolean).join(' · ') }}</span>
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-x-4 px-4 py-3">
          <a :href="mapsUrl" target="_blank" rel="noopener"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-gray-600 hover:text-ink">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            {{ venue.address }}<span class="sr-only"> (atsidaro naujame lange)</span>
          </a>
          <a :href="venue.bookingUrl" target="_blank" rel="noopener"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ball-text hover:text-ball-deep">
            Atidaryti klubo rezervacijas<span class="sr-only"> (atsidaro naujame lange)</span>
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </a>
        </div>
      </div>
    </template>
  </article>
</template>

<script setup lang="ts">
import type { Court, Venue } from '~~/server/utils/types'
import { venueAccent } from '~~/server/utils/venues'
import { SLOT_MIN } from '~~/server/utils/time'
import { formatPrice, ltPlural, nightTag } from '~/utils/format'
import { staleNote, venueProblem } from '~/utils/venue-status'
import { sessionEnd, type StripCell, type VenueSessions } from '~/utils/sessions'
import { chipPrice, venuePricesByKind } from '~/utils/availability'

const props = defineProps<{
  venue: Venue
  courts: Court[]
  sessions: VenueSessions
  strip: StripCell[]
  duration: number
  expanded: boolean
  /** Show the venue's municipality in the info line (when results span several) */
  showMunicipality?: boolean
  /** Start time whose details are open beside the list (desktop), highlighted here */
  selectedTime?: string | null
}>()
const emit = defineEmits<{ toggle: []; pick: [time: string] }>()

const PREVIEW = 4
const IDLE = 'border-ink bg-ink text-ball hover:bg-ink-soft'
const SELECTED = 'border-ball bg-ball text-ink'
const STRIP_CLASS: Record<StripCell['state'], string> = {
  free: 'bg-ink',
  busy: 'bg-court-line',
  past: 'bg-court-faint',
}

const accent = computed(() => venueAccent(props.venue.id))

const problem = computed(() => venueProblem(props.venue))

const mapsUrl = computed(() =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${props.venue.name}, ${props.venue.address}`)}`)

const meta = computed(() => {
  if (problem.value) return props.venue.address
  const n = props.courts.length
  const parts: string[] = props.showMunicipality ? [props.venue.municipality] : []
  parts.push(`${n} ${ltPlural(n, 'kortas', 'kortai', 'kortų')}`)
  // Doubles is what a plain price means; singles is always labelled (it is usually much cheaper)
  const p = venuePricesByKind(props.sessions.starts)
  if (p.doubles !== null) parts.push(`nuo ${formatPrice(p.doubles)} / ${props.duration} min`)
  if (p.singles !== null) parts.push(`1v1 nuo ${formatPrice(p.singles)}`)
  // Older data after a failed scrape: say how old, since the page header shows the newer fetch time
  const stale = staleNote(props.venue)
  if (stale) parts.push(stale)
  // Non-breaking spaces keep each phrase ("1v1 nuo €30") on one line when the info line wraps
  return parts.map(part => part.replace(/ /g, '\u00a0')).join(' · ')
})

/** Collapsed-card chips: doubles price when a doubles court is free, else the singles price marked 1v1 */
const previewStarts = computed(() =>
  props.sessions.starts.slice(0, PREVIEW).map((s) => {
    const { price, singlesOnly } = chipPrice(s)
    const priceStr = price !== null ? formatPrice(price) : ''
    return {
      time: s.time,
      priceText: [nightTag(s.time), priceStr, singlesOnly ? '1v1' : ''].filter(Boolean).join(' · '),
      label: [s.time, nightTag(s.time), priceStr, singlesOnly ? 'tik 1v1 kortai' : '', props.venue.name].filter(Boolean).join(', '),
    }
  })
)

const moreLabel = computed(() => {
  const n = props.sessions.starts.length - PREVIEW
  return `Rodyti dar ${n} ${ltPlural(n, 'laiką', 'laikus', 'laikų')}`
})

const courtsWithStarts = computed(() => props.sessions.perCourt.filter(c => c.starts.length > 0))

const stripLabel = computed(() => {
  const free = props.strip.filter(c => c.state === 'free').length
  return `Dienos užimtumas: ${free} laisvi pusvalandžiai iš ${props.strip.length}`
})

/** First, middle and closing time under the strip */
const stripLabels = computed(() => {
  const s = props.strip
  if (!s.length) return []
  const mid = s[Math.floor(s.length / 2)]!.time
  return [s[0]!.time, mid, sessionEnd(s[s.length - 1]!.time, SLOT_MIN)]
})
</script>
