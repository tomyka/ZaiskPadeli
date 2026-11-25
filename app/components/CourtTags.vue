<template>
  <span :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE[kind].class]">{{ TYPE[kind].label }}</span>
  <span v-if="court.indoor !== undefined" class="text-xs text-gray-500">{{ court.indoor ? 'Vidaus' : 'Lauko' }}</span>
</template>

<script setup lang="ts">
import type { Court, CourtKind } from '~~/server/utils/types'
import { courtKind } from '~/utils/availability'

/** Court type badge plus indoor/outdoor label */
const props = defineProps<{ court: Court }>()

const TYPE: Record<CourtKind, { label: string; class: string }> = {
  doubles: { label: '2v2', class: 'bg-blue-50 text-blue-700' },
  singles: { label: '1v1', class: 'bg-purple-50 text-purple-700' },
}

const kind = computed(() => courtKind(props.court))
</script>
