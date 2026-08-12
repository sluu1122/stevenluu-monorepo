import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // recharts installs a copy under both packages/ui and this app, and the
    // chart components read their size from a React context created by
    // ResponsiveContainer. Two copies means two distinct context objects, so
    // the chart falls back to the default size of zero and renders nothing.
    // Vite's dev server pre-bundles to a single instance and hides this; the
    // production build does not.
    dedupe: ['recharts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repo/resume-data': path.resolve(__dirname, '../../../packages/resume-data/src/index.ts'),
      '@repo/ui': path.resolve(__dirname, '../../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
  },
})
