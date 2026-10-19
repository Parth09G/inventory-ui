/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { msw } from 'msw/vite'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
/** Demo mode: stand-in for the signed Storage links (invoice PDFs, exports). */
const demoFiles = (): Plugin => ({
  name: 'demo-files',
  configureServer(server) {
    server.middlewares.use('/demo-files', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(
        `<!doctype html><meta charset="utf-8"><title>Demo file</title><body style="font:16px system-ui;margin:3rem;max-width:40rem"><h1 style="font-size:1.25rem">Demo file: ${req.url?.slice(1)}</h1><p>In the real app this opens the PDF, Excel or Tally XML file from Supabase Storage, through a link valid for 10 minutes.</p></body>`,
      )
    })
  },
})

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'demo' ? [msw(), demoFiles()] : []),
    // Must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // App-shell caching only; billing still needs the network (HLD 6.3). See decisions.md D-12.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Billing & Inventory',
        short_name: 'Billing',
        description: 'Bills, stock and ledgers for the shop and godowns',
        lang: 'en-IN',
        display: 'standalone',
        start_url: '/',
        background_color: '#f7f7f4',
        theme_color: '#1c1f23',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/demo-files\//],
        globIgnores: ['**/mockServiceWorker.js'],
      },
    }),
  ],
  // Pre-bundle every dependency at startup, so a dependency first used deep in the app
  // does not trigger a re-optimise and full reload mid-session (and mid-test).
  optimizeDeps: { entries: ['src/**/*.{ts,tsx}'] },
  // One dependency cache per mode, so dev, demo and the e2e server can run side by side.
  cacheDir: mode === 'development' ? 'node_modules/.vite' : `node_modules/.vite-${mode}`,
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
