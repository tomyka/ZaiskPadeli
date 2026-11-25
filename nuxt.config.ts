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
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // Display font for brand, venue names, day numbers and times
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap' },
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
    cssPath: '~/app/assets/css/tailwind.css',
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
