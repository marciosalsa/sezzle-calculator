/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the Vite dev server proxies /api to the Go backend, so the
// browser talks to a single origin and no CORS setup is needed.
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backendUrl,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
    },
  },
})
