import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@repo/resume-data': path.resolve(__dirname, '../../packages/resume-data/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
})
