<template>
  <span :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE[kind].class]">{{ TYPE[kind].label }}</span>
  <span v-if="court.indoor !== undefined" class="text-xs text-gray-600">{{ court.indoor ? 'Vidaus' : 'Lauko' }}</span>
</template>

<script setup lang="ts">
import type { Court, CourtKind } from '~~/server/utils/types'
import { courtKind } from '~/utils/availability'

/** Court type badge plus indoor/outdoor label */
const props = defineProps<{ court: Court }>()

const TYPE: Record<CourtKind, { label: string; class: string }> = {
  doubles: { label: '2v2', class: 'bg-ink/5 text-ink' },
  singles: { label: '1v1', class: 'bg-ball-tint text-ball-text' },
}

const kind = computed(() => courtKind(props.court))
</script>
