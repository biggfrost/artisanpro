import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',   // on garde notre SW custom (push, routes)
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',     // maj appliquée proprement, sans cache obsolète
      injectRegister: null,           // on enregistre via virtual:pwa-register
      manifest: false,                // on garde public/manifest.json existant
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // pdf-vendor ~358KB, marge large
      },
      devOptions: { enabled: false }, // pas de SW en dev (évite les surprises)
    }),
  ],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2015',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-vendor':    ['jspdf'],
          'react-vendor':  ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'query-vendor':  ['@tanstack/react-query'],
          'supabase':      ['@supabase/supabase-js'],
        },
      },
    },
  },
})
