<template>
  <fieldset>
    <legend class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">{{ legend }}</legend>
    <div class="grid overflow-hidden rounded-xl border border-gray-300" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }">
      <button v-for="(o, i) in options" :key="String(o.value)" type="button" :aria-pressed="model === o.value"
        @click="model = o.value"
        :class="['h-11 text-sm transition-colors', i > 0 ? 'border-l border-gray-300' : '',
          model === o.value ? 'bg-emerald-600 font-semibold text-white' : 'bg-white text-gray-700 hover:bg-gray-50']">
        {{ o.label }}
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts" generic="T">
/** A row of mutually exclusive choices (court type, indoor/outdoor, duration) */
defineProps<{ legend: string; options: { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>
