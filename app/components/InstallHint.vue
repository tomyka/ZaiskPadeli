<template>
  <!-- Phones only, and only where installing is possible: Chrome/Android offered its install
       prompt, or iOS Safari (which has no prompt: the sheet explains the Share menu) -->
  <div v-if="visible" class="mx-auto max-w-3xl px-4 pt-3 sm:px-6 lg:hidden">
    <div class="flex items-center gap-3 rounded-2xl border border-court-line bg-white py-2 pl-3.5 pr-1.5 shadow-sm">
      <img src="/icon-192.png" alt="" class="h-9 w-9 shrink-0 rounded-lg" width="36" height="36">
      <p class="min-w-0 flex-1 text-[13px] leading-snug text-gray-600">
        <span class="block font-semibold text-ink">Žaisk Padelį telefone</span>
        Atsidaro iš pradžios ekrano kaip programėlė
      </p>
      <button type="button" @click="install"
        class="min-h-[44px] shrink-0 rounded-xl bg-ball px-3.5 text-sm font-bold text-ink transition hover:bg-ball-deep active:scale-[0.97]">
        Įdiegti
      </button>
      <button type="button" aria-label="Nerodyti pasiūlymo įdiegti" @click="dismiss"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-700">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  <BottomSheet :open="iosSheetOpen" title="Įdiegti iPhone ar iPad" @close="iosSheetOpen = false">
    <ol class="space-y-4 text-[15px] text-ink">
      <li class="flex items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-ball">1</span>
        <span>
          Apačioje bakstelėkite
          <svg class="mx-0.5 inline h-5 w-5 -translate-y-0.5 text-[#007aff]" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0-12L8 7m4-4 4 4M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
          </svg>
          <b>Bendrinti</b>
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
 * Offers to install the app on a phone (#50). Android/Chrome: the browser's own install prompt,
 * captured by the PWA module's client plugin ($pwa). iOS Safari has no prompt, so the hint opens
 * instructions. Never shown inside the installed app; a dismissal is remembered on this device.
 */

/** Same key the PWA module uses for its own install-prompt opt-out */
const HIDE_KEY = 'vite-pwa:hide-install'

const pwa = useNuxtApp().$pwa
const iosSheetOpen = ref(false)
const isIosSafari = ref(false)
const dismissed = ref(true) // until the client has checked (nothing renders during SSR)

onMounted(() => {
  const ua = navigator.userAgent
  // Safari on iPhone / iPad (iPadOS reports a Mac with touch); other iOS browsers can't add to home screen as an app
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  isIosSafari.value = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  try { dismissed.value = localStorage.getItem(HIDE_KEY) === 'true' } catch { dismissed.value = false }
})

const installed = computed(() => !!pwa?.isPWAInstalled
  || (import.meta.client && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)))

const visible = computed(() => !dismissed.value && !installed.value && (!!pwa?.showInstallPrompt || isIosSafari.value))

async function install() {
  if (pwa?.showInstallPrompt) await pwa.install()
  else iosSheetOpen.value = true
}

function dismiss() {
  dismissed.value = true
  if (pwa) pwa.cancelInstall()
  try { localStorage.setItem(HIDE_KEY, 'true') } catch { /* private mode: hidden for this visit only */ }
}
</script>
