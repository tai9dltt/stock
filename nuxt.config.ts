// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  css: [
    '~/assets/css/main.css'
  ],

  runtimeConfig: {
    // Server-only config (not exposed to client)
    vietstockCookie: process.env.VIETSTOCK_COOKIE_RAW || '',
    vietstockToken: process.env.VIETSTOCK_TOKEN || '',
    vietstockEmail: process.env.VIETSTOCK_EMAIL || '',
    vietstockPassword: process.env.VIETSTOCK_PASSWORD || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    // Database config
    dbHost: process.env.DB_HOST || 'localhost',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'stock_analysis_db',
    // Client-side config (exposed to client)
    public: {
      spreadjsLicenseKey: process.env.SPREADJS_LICENSE_KEY || '',
    },
  },

  // Enable SSR for full-stack capabilities
  ssr: true,

  // TypeScript configuration
  typescript: {
    strict: true
  },

  // Vue compiler options
  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => tag.startsWith('gc-')
    }
  }
})
