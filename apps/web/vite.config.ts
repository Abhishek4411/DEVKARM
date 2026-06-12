import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const webPort = Number(process.env.VITE_PORT) || 5173

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.wasm'],
  server: {
    port: webPort,
    strictPort: false,
    // If the preferred port is taken, Vite tries the next free port automatically.
  },
})
