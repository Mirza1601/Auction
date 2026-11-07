import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Ensure env variables prefixed with VITE_ are exposed to the browser
  envPrefix: 'VITE_',
})
