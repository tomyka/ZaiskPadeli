<template>
  <div class="flex min-h-screen flex-col bg-court-bg">
    <!-- <link rel="manifest">: without it browsers don't offer to install the app (#50) -->
    <NuxtPwaManifest />
    <!-- Accent bar -->
    <div class="h-1 shrink-0 bg-ball"></div>

    <!-- Header -->
    <header class="court-lines sticky top-0 z-50 shrink-0 bg-ink shadow-md">
      <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-[100rem] lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <!-- Logo "Paukščiukas" (#51): the mark is the Ž of Žaisk, its háček a bounce with the ball at the bounce point -->
          <a href="/" aria-label="Žaisk Padelį" class="group flex select-none items-baseline">
            <svg viewBox="52 10 98 162" class="h-[25.9px] w-[15.7px] shrink-0 overflow-visible" aria-hidden="true">
              <path d="M56 72 H146 V94 L86 150 H146 V172 H56 V150 L116 94 H56 Z" class="fill-white"/>
              <g class="logo-bounce">
                <path d="M67 18 L101 46 L135 18" fill="none" class="stroke-ball" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="101" cy="48" r="16" class="fill-ball stroke-ink" stroke-width="5"/>
              </g>
            </svg>
            <span class="font-display text-[22px] font-bold uppercase leading-none tracking-wide text-white">aisk <span class="text-ball">Padelį</span></span>
          </a>
          <div class="flex items-center">
            <ClientOnly><InstallButton /></ClientOnly>
            <!-- Donation lives in the header: a floating button covered time chips and the footer -->
            <a href="https://revolut.me/tomyka" target="_blank" rel="noopener"
              aria-label="Paremti projektą per Revolut (atsidaro naujame lange)"
              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-muted transition hover:text-ball">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
                <path stroke-linejoin="round" d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" /><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" />
              </svg>
              Paremti
            </a>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <footer class="shrink-0 border-t border-court-line bg-white/60 py-5">
      <div class="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 px-4 text-xs text-gray-600 sm:flex-row sm:px-6 lg:max-w-[100rem] lg:px-8">
        <span>© {{ new Date().getFullYear() }} Žaisk Padelį</span>
        <span>Duomenys atnaujinami kas 5 min · Kainos nurodytos už visą žaidimo laiką</span>
      </div>
    </footer>
  </div>
</template>
