/**
 * copy-wasm.js — postinstall script (ESM)
 *
 * Copies tree-sitter WASM files from node_modules into public/ so Vite
 * can serve them correctly. Runs automatically after every `npm install`
 * via the "postinstall" script in package.json.
 *
 * The public/ WASM files are gitignored — they MUST be regenerated after
 * every fresh clone or node_modules clean. If this step is skipped,
 * Trinity Sync (code→canvas) breaks with:
 *   "expected magic word 00 61 73 6d" (Vite serves index.html instead of WASM)
 *
 * Source paths:
 *   web-tree-sitter/web-tree-sitter.wasm  → public/tree-sitter.wasm
 *   tree-sitter-javascript/tree-sitter-javascript.wasm → public/tree-sitter-javascript.wasm
 */

import { copyFileSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root      = join(__dirname, '..')

const copies = [
  {
    src: join(root, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm'),
    dst: join(root, 'public', 'tree-sitter.wasm'),
  },
  {
    src: join(root, 'node_modules', 'tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
    dst: join(root, 'public', 'tree-sitter-javascript.wasm'),
  },
]

let allOk = true
for (const { src, dst } of copies) {
  try {
    copyFileSync(src, dst)
    console.log(`[copy-wasm] ✓ ${basename(src)} → ${basename(dst)}`)
  } catch (err) {
    console.error(`[copy-wasm] ✗ Failed: ${basename(src)}: ${err.message}`)
    allOk = false
  }
}

if (!allOk) process.exit(1)
