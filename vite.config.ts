import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '', // Empty string = Relative paths (Works for Vercel ROOT and GH Pages SUBDIR)
  build: {
    target: 'es2020'
  }
})
