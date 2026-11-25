<template>
  <div ref="root" class="relative">
    <!-- Trigger: a pill like the other filters; ink when it narrows results (`active`) -->
    <button ref="trigger" type="button" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="listId"
      :aria-label="`${label}: ${selected?.label ?? ''}`"
      :class="['flex h-11 w-full min-w-0 items-center gap-1.5 rounded-full border pl-3 pr-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ball-deep focus-visible:ring-offset-2',
        active ? 'border-ink bg-ink text-ball' : 'border-court-line bg-white text-ink hover:border-ink/40']"
      @click="toggle" @keydown="onTriggerKey">
      <span :class="['shrink-0', active ? 'text-ball' : 'text-gray-600']"><slot name="icon" /></span>
      <span class="min-w-0 flex-1 truncate text-left font-medium">{{ selected?.label }}</span>
      <svg :class="['h-3.5 w-3.5 shrink-0 transition-transform', open ? 'rotate-180' : '', active ? 'text-ball' : 'text-gray-600']"
        fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- Teleported and fixed-positioned, so a scrolling ancestor (the desktop sidebar) can't clip it -->
    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out" enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in" leave-to-class="-translate-y-1 opacity-0">
      <ul v-if="open" :id="listId" ref="list" role="listbox" tabindex="-1" :aria-label="label"
        :aria-activedescendant="optionId(highlighted)" :style="panelStyle"
        class="fixed z-[70] w-max max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-court-line bg-white p-1.5 shadow-xl outline-none"
        @keydown="onListKey">
        <li v-for="(o, i) in options" :id="optionId(i)" :key="String(o.value)" role="option" :aria-selected="o.value === model"
          :class="['flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-sm',
            o.value === model ? 'bg-ink font-semibold text-ball' : i === highlighted ? 'bg-court-bg text-ink' : 'text-ink']"
          @pointermove="highlighted = i" @click="choose(i)">
          <span>{{ o.label }}</span>
          <span v-if="o.hint"
            :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', o.value === model ? 'bg-ink-soft text-ink-muted' : 'bg-court-faint text-gray-600']">
            {{ o.hint }}
          </span>
        </li>
      </ul>
    </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts" generic="T">
/**
 * A single-choice dropdown in the project's style: pill trigger, rounded panel,
 * ink-on-ball selected option. Use it instead of a native <select>, whose open list
 * the browser/OS draws in its own style.
 *
 * Keyboard (listbox pattern): Enter / Space / ↓ / ↑ open; ↑ ↓ Home End move;
 * a letter jumps to the next option starting with it; Enter / Space choose;
 * Escape closes; Tab closes and moves on. Focus returns to the trigger after a choice.
 */
const props = withDefaults(defineProps<{
  /** Accessible name of the control, e.g. "Apskritis" */
  label: string
  options: { value: T; label: string; hint?: string }[]
  /** Style the trigger as a selected filter (ink), like the other active pills */
  active?: boolean
}>(), { active: false })
const model = defineModel<T>({ required: true })

const open = ref(false)
const highlighted = ref(0)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)

const uid = useId()
const listId = `select-${uid}`
const optionId = (i: number) => `${listId}-${i}`

const selectedIndex = computed(() => Math.max(0, props.options.findIndex(o => o.value === model.value)))
const selected = computed(() => props.options[selectedIndex.value])

/** Below the trigger, or above it when there is clearly more room there; never off-screen */
const panelStyle = ref<Record<string, string>>({})
const GAP = 8
const MARGIN = 16
const MAX_HEIGHT = 384

function place() {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  const below = window.innerHeight - r.bottom - GAP - MARGIN
  const above = r.top - GAP - MARGIN
  const up = below < 240 && above > below
  const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - MARGIN - r.width))
  panelStyle.value = {
    left: `${left}px`,
    minWidth: `${r.width}px`,
    maxHeight: `${Math.min(MAX_HEIGHT, up ? above : below)}px`,
    ...(up ? { bottom: `${window.innerHeight - r.top + GAP}px` } : { top: `${r.bottom + GAP}px` }),
  }
}

async function show(at = selectedIndex.value) {
  place()
  open.value = true
  highlighted.value = at
  await nextTick()
  list.value?.focus()
  scrollToHighlighted()
}

function hide(focusTrigger = true) {
  open.value = false
  if (focusTrigger) trigger.value?.focus()
}

function toggle() {
  if (open.value) hide()
  else show()
}

function choose(i: number) {
  const o = props.options[i]
  if (o) model.value = o.value
  hide()
}

function move(to: number) {
  highlighted.value = Math.min(props.options.length - 1, Math.max(0, to))
  scrollToHighlighted()
}

function scrollToHighlighted() {
  nextTick(() => document.getElementById(optionId(highlighted.value))?.scrollIntoView({ block: 'nearest' }))
}

function onTriggerKey(e: KeyboardEvent) {
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    show()
  }
}

function onListKey(e: KeyboardEvent) {
  const last = props.options.length - 1
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); move(highlighted.value + 1); break
    case 'ArrowUp': e.preventDefault(); move(highlighted.value - 1); break
    case 'Home': e.preventDefault(); move(0); break
    case 'End': e.preventDefault(); move(last); break
    case 'Enter': case ' ': e.preventDefault(); choose(highlighted.value); break
    case 'Escape': e.preventDefault(); hide(); break
    case 'Tab': hide(false); break
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(e.key)
  }
}

/** Jump to the next option whose label starts with the typed letter */
function typeAhead(ch: string) {
  const n = props.options.length
  const key = ch.toLocaleLowerCase('lt')
  for (let step = 1; step <= n; step++) {
    const i = (highlighted.value + step) % n
    if (props.options[i]!.label.toLocaleLowerCase('lt').startsWith(key)) { move(i); return }
  }
}

/** Close on a press anywhere outside the trigger and the panel */
function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (open.value && !root.value?.contains(t) && !list.value?.contains(t)) hide(false)
}
/** Keep the panel attached to the trigger while the page or the sidebar scrolls */
function onViewportChange() {
  if (open.value) place()
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>
