import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Tell Vite to treat .wasm files as static assets (not JS modules).
  // Without this, Vite's SPA fallback can intercept /tree-sitter.wasm
  // and serve index.html instead — causing "expected magic word 00 61 73 6d".
  assetsInclude: ['**/*.wasm'],

  server: {
    // Ensure the dev server sets the correct MIME type for .wasm files.
    headers: {
      'Content-Type': 'application/wasm',
    },
    // Prevent SPA fallback from hijacking .wasm file requests.
    fs: {
      strict: false,
    },
  },
})
