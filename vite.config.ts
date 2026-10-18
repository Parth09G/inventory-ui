/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // App-shell caching only; billing still needs the network (HLD 6.3). See decisions.md D-12.
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Billing & Inventory',
        short_name: 'Billing',
        lang: 'en-IN',
        display: 'standalone',
        start_url: '/',
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  // Pre-bundle every dependency at startup, so a dependency first used deep in the app
  // does not trigger a re-optimise and full reload mid-session (and mid-test).
  optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
