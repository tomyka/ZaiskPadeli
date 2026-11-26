// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
  ],

  app: {
    head: {
      title: 'Žaisk Padelį',
      meta: [
        { name: 'description', content: 'Visos Lietuvos padelio aikštelių užimtumas vienoje vietoje' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#111827' },
        // iOS home-screen app: full screen, its own name, dark status bar over the ink header
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Žaisk Padelį' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
      ],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7290396604686794',
          async: true,
          crossorigin: 'anonymous',
        },
      ],
    },
  },

  // Installable app (#50). The page links the manifest via <NuxtPwaManifest /> in app.vue,
  // and the module's client plugin registers the service worker.
  pwa: {
    registerType: 'autoUpdate',
    // Captures the browser's install prompt for our own hint (InstallHint.vue); a dismissal is
    // remembered in localStorage under 'vite-pwa:hide-install'
    client: { installPrompt: true },
    manifest: {
      id: '/',
      name: 'Žaisk Padelį',
      short_name: 'Žaisk Padelį',
      description: 'Visos Lietuvos padelio aikštelių užimtumas vienoje vietoje',
      lang: 'lt',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#111827',
      background_color: '#f3f4f6',
      categories: ['sports', 'lifestyle'],
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        // The artwork sits well inside the central 80% safe zone on a full-bleed background
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      screenshots: [
        { src: '/screenshot-narrow.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow', label: 'Laisvi padelio kortai šalia jūsų' },
        { src: '/screenshot-wide.png', sizes: '1440x900', type: 'image/png', form_factor: 'wide', label: 'Visų klubų laisvi laikai vienoje vietoje' },
      ],
    },
    workbox: {
      // Server-rendered pages: there is no prebuilt index.html to answer every navigation with
      navigateFallback: null,
      // Setting globPatterns replaces Workbox's defaults; the module adds its build-manifest JSON
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
      globIgnores: ['screenshot-*.png'],
      runtimeCaching: [
        {
          // Pages: always fresh when online; the last one opens offline
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: { cacheName: 'pages', networkTimeoutSeconds: 5, expiration: { maxEntries: 10 } },
        },
        {
          // Availability: fresh when online; offline (or a dead network) shows the last loaded day,
          // whose "Atnaujinta HH:MM" says how old it is
          urlPattern: ({ url }) => url.pathname === '/api/availability',
          handler: 'NetworkFirst',
          options: { cacheName: 'availability', networkTimeoutSeconds: 10, expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 } },
        },
      ],
    },
  },

  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css', // ~ is app/ in Nuxt 4
  },

  nitro: {
    routeRules: {
      // API consumed only by the same origin; no open CORS needed
      '/api/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      },
    },
    vercel: {
      regions: ['arn1'],
    },
  },
})
