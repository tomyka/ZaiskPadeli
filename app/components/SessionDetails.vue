<template>
  <div>
    <!-- Right padding keeps the heading clear of the container's close button -->
    <div class="pr-12">
      <p class="text-[13px] text-gray-600">{{ sheet.venue.name }} · {{ dayLabel }}</p>
      <h2 class="text-[26px] font-bold tabular-nums text-gray-900">{{ sheet.start.time }} – {{ sessionEnd(sheet.start.time, duration) }}</h2>
      <p class="text-sm text-gray-600">
        {{ duration }} min · {{ sheet.start.courts.length }} {{ ltPlural(sheet.start.courts.length, 'laisvas kortas', 'laisvi kortai', 'laisvų kortų') }}
      </p>
    </div>

    <ul class="mt-4 space-y-2.5">
      <li v-for="c in sheet.start.courts" :key="c.court.id"
        class="flex items-center gap-3 rounded-2xl border border-gray-200 px-3.5 py-3">
        <div class="min-w-0 flex-1">
          <span class="block truncate text-[15px] font-semibold text-gray-900">{{ c.court.name }}</span>
          <span class="mt-0.5 flex items-center gap-2"><CourtTags :court="c.court" /></span>
        </div>
        <span v-if="c.price !== null" class="text-[17px] font-bold tabular-nums text-gray-900">{{ formatPrice(c.price) }}</span>
        <a :href="sheet.venue.bookingUrl" target="_blank" rel="noopener"
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
    <div v-if="sheet.others.length" class="mt-4">
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Kiti laikai</p>
      <div class="grid grid-cols-4 gap-1.5">
        <button v-for="s in sheet.others" :key="s.time" type="button"
          class="h-11 rounded-xl border border-gray-300 bg-white text-sm tabular-nums text-gray-800 transition hover:border-emerald-300"
          @click="emit('pick', s.time)">
          {{ s.time }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionSheet } from '~/utils/availability'
import { formatPrice, ltPlural } from '~/utils/format'
import { sessionEnd } from '~/utils/sessions'

/** One bookable session: free courts with price and booking link, plus other start times */
defineProps<{ sheet: SessionSheet; duration: number; dayLabel: string }>()
const emit = defineEmits<{ pick: [time: string] }>()
</script>
