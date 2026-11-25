<template>
  <article :class="['overflow-hidden rounded-2xl border bg-white shadow-sm',
    selectedTime ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200/80']">
    <!-- Summary row: toggles the per-court view -->
    <button type="button" :aria-expanded="expanded" :disabled="!!venue.error"
      class="flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left disabled:cursor-default"
      @click="emit('toggle')">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: accent }" aria-hidden="true"></span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-[15px] font-semibold text-gray-900">{{ venue.name }}</span>
        <span class="block truncate text-xs text-gray-600">{{ meta }}</span>
      </span>
      <template v-if="!venue.error">
        <span class="shrink-0 text-[13px] font-semibold text-emerald-700 tabular-nums">
          {{ sessions.starts.length }} {{ ltPlural(sessions.starts.length, 'laikas', 'laikai', 'laikų') }}
        </span>
        <svg :class="['h-5 w-5 shrink-0 text-gray-500 transition-transform', expanded ? 'rotate-180' : '']"
          fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </template>
      <span v-else class="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Klaida</span>
    </button>

    <p v-if="venue.error" class="px-4 pb-4 text-sm text-gray-600">{{ venue.error }}</p>

    <template v-else>
      <!-- Day availability strip -->
      <div class="px-4" role="img" :aria-label="stripLabel">
        <div class="grid h-2 gap-px overflow-hidden rounded" :style="{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }">
          <span v-for="cell in strip" :key="cell.time" :class="STRIP_CLASS[cell.state]"></span>
        </div>
        <div v-if="strip.length" class="mt-1 flex justify-between text-[10px] tabular-nums text-gray-500" aria-hidden="true">
          <span v-for="label in stripLabels" :key="label">{{ label }}</span>
        </div>
      </div>

      <!-- Collapsed: next few start times -->
      <div v-if="!expanded" class="flex gap-1.5 px-4 pb-3 pt-2.5">
        <button v-for="s in sessions.starts.slice(0, PREVIEW)" :key="s.time" type="button"
          :aria-pressed="s.time === selectedTime"
          :class="['h-11 min-w-0 flex-1 rounded-xl border text-sm font-semibold tabular-nums transition active:scale-[0.97] lg:max-w-[5rem]',
            s.time === selectedTime ? SELECTED : IDLE]"
          @click="emit('pick', s.time)">
          {{ s.time }}
        </button>
        <button v-if="sessions.starts.length > PREVIEW" type="button"
          :aria-label="`Rodyti dar ${sessions.starts.length - PREVIEW} laikus`"
          class="h-11 shrink-0 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50"
          @click="emit('toggle')">
          +{{ sessions.starts.length - PREVIEW }}
        </button>
      </div>

      <!-- Expanded: start times per court -->
      <div v-else class="mt-2 divide-y divide-gray-100 border-t border-gray-100">
        <div v-for="{ court, starts } in courtsWithStarts" :key="court.id" class="px-4 py-3">
          <div class="mb-2 flex items-center gap-2">
            <span class="text-sm font-semibold text-gray-800">{{ court.name }}</span>
            <CourtTags :court="court" />
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
            <button v-for="s in starts" :key="s.time" type="button"
              :aria-pressed="s.time === selectedTime"
              :class="['flex min-h-[3rem] flex-col items-center justify-center rounded-xl border transition active:scale-[0.97]',
                s.time === selectedTime ? SELECTED : IDLE]"
              @click="emit('pick', s.time)">
              <span class="text-sm font-semibold tabular-nums">{{ s.time }}</span>
              <span v-if="s.price !== null" class="text-[11px]" :class="s.time === selectedTime ? 'text-emerald-50' : 'text-emerald-700'">{{ formatPrice(s.price) }}</span>
            </button>
          </div>
        </div>
        <div class="px-4 py-3">
          <a :href="venue.bookingUrl" target="_blank" rel="noopener"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Atidaryti klubo rezervacijas
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
import { venueInfo } from '~~/server/utils/venues'
import { SLOT_MIN } from '~~/server/utils/time'
import { formatPrice, ltPlural } from '~/utils/format'
import { sessionEnd, type StripCell, type VenueSessions } from '~/utils/sessions'

const props = defineProps<{
  venue: Venue
  courts: Court[]
  sessions: VenueSessions
  strip: StripCell[]
  duration: number
  expanded: boolean
  /** Start time whose details are open beside the list (desktop), highlighted here */
  selectedTime?: string | null
}>()
const emit = defineEmits<{ toggle: []; pick: [time: string] }>()

const PREVIEW = 4
const IDLE = 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
const SELECTED = 'border-emerald-600 bg-emerald-600 text-white'
const STRIP_CLASS: Record<StripCell['state'], string> = {
  free: 'bg-emerald-500',
  busy: 'bg-gray-200',
  past: 'bg-gray-100',
}

const accent = computed(() => venueInfo(props.venue.id)?.color ?? '#9ca3af')

const meta = computed(() => {
  if (props.venue.error) return props.venue.address
  const n = props.courts.length
  const parts = [`${n} ${ltPlural(n, 'kortas', 'kortai', 'kortų')}`]
  if (props.sessions.minPrice !== null) parts.push(`nuo ${formatPrice(props.sessions.minPrice)} / ${props.duration} min`)
  return parts.join(' · ')
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
