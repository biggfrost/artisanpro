import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    hmr: { overlay: true },
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
