<template>
  <!-- In the header, so it never pushes the page around when Chrome's prompt arrives late.
       Phones only, and only where installing is possible and the app isn't installed yet. -->
  <button v-if="visible" type="button" @click="install"
    class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted transition hover:text-ball lg:hidden">
    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
    </svg>
    Įdiegti
  </button>

  <BottomSheet :open="sheetOpen" title="Įdiegti į pradžios ekraną" @close="sheetOpen = false">
    <ol class="space-y-4 text-[15px] text-ink">
      <li class="flex items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-ball">1</span>
        <span>
          Bakstelėkite
          <svg class="mx-0.5 inline h-5 w-5 -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0-12L8 7m4-4 4 4M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
          </svg>
          <b>Bendrinti</b>
          <span class="text-gray-600">({{ shareWhere }})</span>
        </span>
      </li>
      <li class="flex items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-ball">2</span>
        <span>Pasirinkite <b>Į pradžios ekraną</b> (gali tekti paslinkti žemyn)</span>
      </li>
      <li class="flex items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-ball">3</span>
        <span>Bakstelėkite <b>Pridėti</b></span>
      </li>
    </ol>
    <p class="mt-5 text-xs leading-relaxed text-gray-600">
      Žaisk Padelį atsiras pradžios ekrane ir atsidarys be naršyklės juostų.
    </p>
  </BottomSheet>
</template>

<script setup lang="ts">
/**
 * "Įdiegti" in the header (#50). Chrome/Android: the browser's own install prompt, captured by
 * the PWA module's client plugin ($pwa). iPhone/iPad have no prompt: any browser there (Safari,
 * and since iOS 16.4 Chrome, Edge, Firefox) adds to the home screen from its Share menu, so the
 * button opens those steps. Hidden inside the installed app.
 */

const pwa = useNuxtApp().$pwa
const sheetOpen = ref(false)
const ios = ref(false)
const iosSafari = ref(false)
const standalone = ref(true) // until the client has checked

onMounted(() => {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac with touch
  ios.value = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  iosSafari.value = ios.value && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  standalone.value = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true
})

const visible = computed(() => !standalone.value && !pwa?.isPWAInstalled && (!!pwa?.showInstallPrompt || ios.value))

/** Safari keeps Share in the bottom bar; Chrome, Edge and Firefox on iOS put it by the address bar */
const shareWhere = computed(() => (iosSafari.value ? 'apačioje' : 'šalia adreso juostos'))

async function install() {
  if (pwa?.showInstallPrompt) await pwa.install()
  else sheetOpen.value = true
}
</script>
