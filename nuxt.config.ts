// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  css: [
    '~/assets/css/ag-grid-custom.css',
    '~/assets/css/main.css'
  ],

  runtimeConfig: {
    // Server-only config (not exposed to client)
    vietstockCookie: process.env.VIETSTOCK_COOKIE_RAW || '',
    vietstockToken: process.env.VIETSTOCK_TOKEN || ''
  },

  // Enable SSR for full-stack capabilities
  ssr: true,

  // TypeScript configuration
  typescript: {
    strict: true
  }
})
