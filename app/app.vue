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
          <!-- Logo "Paukščiukas" (#51): the Ž of Žaisk, its háček a bounce with the ball at the bounce point -->
          <a href="/" aria-label="Žaisk Padelį"
            class="group flex select-none items-baseline font-display text-[22px] font-bold uppercase leading-none tracking-wide text-white">
            <!-- The font's own Z, so the Ž matches the other letters; only the háček (a bounce, ball at its point) is drawn -->
            <span class="relative">Z<svg viewBox="62 13 78 58" class="absolute left-[-0.006em] top-[-0.16em] h-[0.312em] w-[0.42em] overflow-visible" aria-hidden="true">
              <g class="logo-bounce">
                <path d="M68 19 L101 46 L134 19" fill="none" class="stroke-ball" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="101" cy="48" r="18" class="fill-ball stroke-ink" stroke-width="4.5"/>
              </g>
            </svg></span>aisk&nbsp;<span class="text-ball">Padelį</span>
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
