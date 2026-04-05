import { Parser, Language, type Tree } from 'web-tree-sitter'

export type { Tree }

let cachedParser: Parser | null = null
// Singleton promise — concurrent callers all await the same in-flight init.
let initPromise: Promise<Parser> | null = null

/**
 * Pre-fetch a WASM file as an ArrayBuffer.
 * This bypasses Vite's dev-server SPA fallback that can mistakenly serve
 * index.html for static asset URLs, triggering:
 *   "expected magic word 00 61 73 6d, found 3c 21 64 6f"
 * By fetching ourselves first, we can verify the bytes and throw a clear
 * error message if the file is wrong (rather than a cryptic WASM error).
 */
async function fetchWasm(path: string): Promise<ArrayBuffer> {
  const url = new URL(path, window.location.origin).href
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`[parser] Failed to fetch ${path}: HTTP ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  // Verify WASM magic number: 0x00 0x61 0x73 0x6d
  const magic = new Uint8Array(buf, 0, 4)
  if (magic[0] !== 0x00 || magic[1] !== 0x61 || magic[2] !== 0x73 || magic[3] !== 0x6d) {
    const hex = Array.from(magic).map((b) => b.toString(16).padStart(2, '0')).join(' ')
    throw new Error(
      `[parser] ${path} is not a valid WASM file — got magic bytes: ${hex}. ` +
      'Run "node scripts/copy-wasm.js" in apps/web/ to restore the files.',
    )
  }
  return buf
}

/**
 * Initialise web-tree-sitter and load the JavaScript grammar.
 * Safe to call concurrently — all callers await the same promise.
 */
export async function initParser(): Promise<Parser> {
  if (cachedParser) return cachedParser
  if (initPromise) return initPromise

  initPromise = (async () => {
    // Pre-fetch the core WASM binary to ensure we get the real file,
    // not Vite's SPA fallback (which would be an HTML document).
    const treeSitterBuf = await fetchWasm('/tree-sitter.wasm')

    // Monkey-patch WebAssembly.instantiateStreaming for the duration of
    // Parser.init() so that web-tree-sitter uses our already-validated bytes
    // instead of re-fetching. This is the only reliable way to pass a
    // pre-fetched buffer to the Emscripten runtime.
    const origInstantiateStreaming = WebAssembly.instantiateStreaming

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WebAssembly.instantiateStreaming = async (_source: any, importObject: any) => {
      return WebAssembly.instantiate(treeSitterBuf, importObject)
    }

    try {
      await Parser.init({
        locateFile: () => '/tree-sitter.wasm',
      })
    } finally {
      // Always restore — even if Parser.init() throws.
      WebAssembly.instantiateStreaming = origInstantiateStreaming
    }

    // Load the JavaScript grammar. Language.load() uses its own fetch path
    // which correctly handles binary blobs, so pre-fetching is not required here.
    // But we still validate the magic number first as a sanity check.
    await fetchWasm('/tree-sitter-javascript.wasm')
    const lang = await Language.load('/tree-sitter-javascript.wasm')

    const p = new Parser()
    p.setLanguage(lang)
    cachedParser = p
    return p
  })()

  return initPromise
}

/**
 * Parse a code string and return the tree-sitter Tree.
 * initParser() must have been called (and awaited) before this.
 */
export function parseCode(code: string): Tree {
  if (!cachedParser) throw new Error('[parser] Not initialised — call initParser() first')
  return cachedParser.parse(code) as Tree
}
