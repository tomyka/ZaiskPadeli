<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
        <div class="absolute inset-0 bg-gray-900/45" aria-hidden="true" @click="emit('close')"></div>
        <section ref="panel" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"
          class="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl">
          <div class="flex justify-center pt-2 sm:hidden" aria-hidden="true">
            <span class="h-1.5 w-10 rounded-full bg-gray-300"></span>
          </div>
          <header class="flex items-start gap-3 px-5 pt-3">
            <div class="min-w-0 flex-1">
              <slot name="header">
                <h2 class="text-xl font-bold text-gray-900">{{ title }}</h2>
              </slot>
            </div>
            <button type="button" aria-label="Uždaryti" @click="emit('close')"
              class="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    window.addEventListener('keydown', onKey)
    await nextTick()
    panel.value?.focus()
  } else {
    window.removeEventListener('keydown', onKey)
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>
