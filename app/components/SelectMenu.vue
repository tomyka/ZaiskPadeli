<template>
  <div ref="root" class="relative">
    <!-- Trigger: a pill like the other filters; ink when it narrows results (`active`) -->
    <button ref="trigger" type="button" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="open ? listId : undefined"
      :aria-label="`${label}: ${selected?.label ?? ''}`"
      :class="['flex h-11 w-full min-w-0 items-center gap-1.5 rounded-full border pl-3 pr-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ball-deep focus-visible:ring-offset-2',
        dashed ? 'border-dashed' : '',
        active ? 'border-ink bg-ink text-ball' : dashed ? 'border-gray-400 bg-white text-gray-700 hover:border-ink/40' : 'border-court-line bg-white text-ink hover:border-ink/40']"
      @click="toggle" @keydown="onTriggerKey">
      <span :class="['shrink-0', active ? 'text-ball' : 'text-gray-600']"><slot name="icon" /></span>
      <span class="min-w-0 flex-1 truncate text-left font-medium">{{ selected?.label }}</span>
      <span v-if="selected?.hint" :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', hintClass(active)]">{{ selected.hint }}</span>
      <svg :class="['h-3.5 w-3.5 shrink-0 transition-transform', open ? 'rotate-180' : '', compact ? 'hidden lg:block' : '', active ? 'text-ball' : 'text-gray-600']"
        fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- Teleported and fixed-positioned, so a scrolling ancestor (the desktop sidebar) can't clip it.
         z-[70]: above BottomSheet (z-[60]) so the picker also works inside a sheet. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out" enter-from-class="-translate-y-1 opacity-0"
        leave-active-class="transition duration-100 ease-in" leave-to-class="-translate-y-1 opacity-0">
        <ul v-if="open" :id="listId" ref="list" role="listbox" tabindex="-1" :aria-label="label"
          :aria-activedescendant="optionId(highlighted)" :style="panelStyle"
          class="fixed z-[70] w-max max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-court-line bg-white p-1.5 shadow-xl outline-none"
          @keydown="onListKey" @focusout="onFocusOut">
          <li v-for="(o, i) in options" :id="optionId(i)" :key="String(o.value)" role="option" :aria-selected="o.value === model"
            :class="['flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-sm',
              o.value === model ? 'bg-ink font-semibold text-ball' : i === highlighted ? 'bg-court-bg text-ink' : 'text-ink',
              i === highlighted && keyboarding ? 'ring-2 ring-inset ring-ball-deep' : '']"
            @pointermove="hover(i)" @click="choose(i)">
            <span>{{ o.label }}</span>
            <span v-if="o.hint" :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', hintClass(o.value === model)]">
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
 * Keyboard (listbox pattern): Enter / Space / ↓ / ↑ open; ↑ ↓ Home End move (the
 * highlighted option gets a ring); a letter jumps to the next option starting with it;
 * Enter / Space choose; Escape closes; Tab closes and moves on like a native select.
 * Focus returns to the trigger after a choice.
 */
const props = withDefaults(defineProps<{
  /** Accessible name of the control, e.g. "Apskritis" */
  label: string
  /** `hint` is a small secondary badge, e.g. "greitai" */
  options: readonly { value: T; label: string; hint?: string }[]
  /** Style the trigger as a selected filter (ink), like the other active pills */
  active?: boolean
  /** Dashed outline: an optional refinement rather than a main filter (the start-time picker) */
  dashed?: boolean
  /** Below desktop width, drop the chevron so the pill fits beside other pills in a tight row */
  compact?: boolean
}>(), { active: false, dashed: false, compact: false })
const model = defineModel<T>({ required: true })

const open = ref(false)
const highlighted = ref(0)
/** Highlight moved by keyboard (show a ring) rather than by the pointer (background only) */
const keyboarding = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)

const listId = `select-${useId()}`
const optionId = (i: number) => `${listId}-${i}`

const selectedIndex = computed(() => Math.max(0, props.options.findIndex(o => o.value === model.value)))
const selected = computed(() => props.options[selectedIndex.value])

// Options can change while open: keep the highlight on an existing option
watch(() => props.options.length, (n) => { highlighted.value = Math.min(highlighted.value, Math.max(0, n - 1)) })

function hintClass(onInk: boolean) {
  return onInk ? 'bg-ink-soft text-ink-muted' : 'bg-court-faint text-gray-600'
}

// ── Placement ────────────────────────────────────────────────────────────────

const panelStyle = ref<Record<string, string>>({})
const GAP = 8
const MARGIN = 16
const MAX_HEIGHT = 384
/** Below the trigger unless there is less than this much room there and more above */
const MIN_ROOM_BELOW = 240
/** Never squeeze the panel shorter than this; it scrolls inside */
const MIN_HEIGHT = 160

/** Below the trigger (or above when there is clearly more room), kept inside the viewport */
function place() {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  const below = window.innerHeight - r.bottom - GAP - MARGIN
  const above = r.top - GAP - MARGIN
  const up = below < MIN_ROOM_BELOW && above > below
  const width = Math.max(r.width, list.value?.offsetWidth ?? 0)
  const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - MARGIN - width))
  panelStyle.value = {
    left: `${left}px`,
    minWidth: `${r.width}px`,
    maxHeight: `${Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, up ? above : below))}px`,
    ...(up ? { bottom: `${window.innerHeight - r.top + GAP}px` } : { top: `${r.bottom + GAP}px` }),
  }
}

// ── Open / close ─────────────────────────────────────────────────────────────

async function show(at = selectedIndex.value, viaKeyboard = false) {
  place()
  open.value = true
  highlighted.value = at
  keyboarding.value = viaKeyboard
  listen(true)
  await nextTick()
  place() // again with the panel's real width, so a wide panel stays on screen
  list.value?.focus()
  scrollToHighlighted()
}

function hide(focusTrigger = true) {
  open.value = false
  listen(false)
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

// ── Highlight ────────────────────────────────────────────────────────────────

function move(to: number) {
  keyboarding.value = true
  highlighted.value = Math.min(props.options.length - 1, Math.max(0, to))
  scrollToHighlighted()
}

function hover(i: number) {
  keyboarding.value = false
  highlighted.value = i
}

function scrollToHighlighted() {
  nextTick(() => document.getElementById(optionId(highlighted.value))?.scrollIntoView({ block: 'nearest' }))
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

// ── Keyboard ─────────────────────────────────────────────────────────────────

function onTriggerKey(e: KeyboardEvent) {
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    show(selectedIndex.value, true)
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
    // The panel lives at the end of <body>: put focus back on the trigger and let the
    // browser's own Tab / Shift+Tab move on from there, as with a native select
    case 'Tab': hide(); break
    default:
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(e.key)
  }
}

// ── Leaving the control ──────────────────────────────────────────────────────

/** Focus moved somewhere other than the trigger (screen-reader cursor, script): close */
function onFocusOut(e: FocusEvent) {
  const to = e.relatedTarget as Node | null
  if (open.value && to && !list.value?.contains(to) && !root.value?.contains(to)) hide(false)
}

/** A press anywhere outside the trigger and the panel closes it */
function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (!root.value?.contains(t) && !list.value?.contains(t)) hide(false)
}

/** Keep the panel attached to the trigger while the page or the sidebar scrolls */
function onViewportChange() {
  place()
}

/** Document-level listeners exist only while the panel is open */
function listen(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onOutside as EventListener)
  window[method]('scroll', onViewportChange, true)
  window[method]('resize', onViewportChange)
}
onBeforeUnmount(() => listen(false))
</script>
