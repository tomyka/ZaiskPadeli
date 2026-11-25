// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
  ],

  // Display font (brand, venue names, day numbers, times), bundled rather than loaded from Google Fonts
  css: [
    '@fontsource/barlow-condensed/500.css',
    '@fontsource/barlow-condensed/600.css',
    '@fontsource/barlow-condensed/700.css',
  ],

  app: {
    head: {
      title: 'Žaisk Padelį',
      meta: [
        { name: 'description', content: 'Visos Lietuvos padelio aikštelių užimtumas vienoje vietoje' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#111827' },
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
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

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Žaisk Padelį',
      short_name: 'Žaisk Padelį',
      description: 'Lietuvos padelio aikštelių užimtumas',
      theme_color: '#111827',
      background_color: '#f3f4f6',
      display: 'standalone',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/',
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
