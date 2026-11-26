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
          <a href="/" class="group flex select-none items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" class="h-7 w-5 shrink-0 transition-transform duration-300 group-hover:rotate-[-8deg]" aria-hidden="true">
              <ellipse cx="12" cy="10.5" rx="9" ry="10" class="fill-ball-deep"/>
              <ellipse cx="12" cy="10.5" rx="7" ry="7.8" class="fill-ball"/>
              <circle cx="9.5" cy="8" r="1" class="fill-ball-deep"/><circle cx="12" cy="8" r="1" class="fill-ball-deep"/><circle cx="14.5" cy="8" r="1" class="fill-ball-deep"/>
              <circle cx="9.5" cy="11" r="1" class="fill-ball-deep"/><circle cx="12" cy="11" r="1" class="fill-ball-deep"/><circle cx="14.5" cy="11" r="1" class="fill-ball-deep"/>
              <circle cx="9.5" cy="14" r="1" class="fill-ball-deep"/><circle cx="12" cy="14" r="1" class="fill-ball-deep"/><circle cx="14.5" cy="14" r="1" class="fill-ball-deep"/>
              <rect x="10.5" y="19" width="3" height="10" rx="1.5" class="fill-ink-muted"/>
              <line x1="10.5" y1="22" x2="13.5" y2="22" class="stroke-ink" stroke-width="0.6"/><line x1="10.5" y1="25" x2="13.5" y2="25" class="stroke-ink" stroke-width="0.6"/>
            </svg>
            <span class="font-display text-[22px] font-bold uppercase tracking-wide text-white">
              Žaisk <span class="text-ball">Padelį</span>
            </span>
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
