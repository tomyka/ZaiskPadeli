<template>
  <div class="space-y-5">
    <SegmentedControl v-model="type" legend="Kortas" :options="TYPE_OPTIONS" />
    <SegmentedControl v-model="indoor" legend="Vieta" :options="INDOOR_OPTIONS" />
  </div>
</template>

<script setup lang="ts">
import type { CourtKind } from '~~/server/utils/types'

/** Court type and indoor/outdoor choices: the desktop sidebar and the phone filter sheet both use this */
const type = defineModel<CourtKind | null>('type', { required: true })
const indoor = defineModel<boolean | null>('indoor', { required: true })

const TYPE_OPTIONS: { value: CourtKind | null; label: string }[] = [
  { value: null, label: 'Visi' }, { value: 'doubles', label: '2v2' }, { value: 'singles', label: '1v1' },
]
const INDOOR_OPTIONS: { value: boolean | null; label: string }[] = [
  { value: null, label: 'Visi' }, { value: true, label: 'Vidaus' }, { value: false, label: 'Lauko' },
]
</script>
