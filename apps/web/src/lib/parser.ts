import { Parser, Language, type Tree } from 'web-tree-sitter'

let parser: Parser | null = null
// Singleton promise prevents concurrent callers from double-initialising the WASM module.
let initPromise: Promise<Parser> | null = null

/**
 * Initialise web-tree-sitter and load the JavaScript grammar.
 * Safe to call concurrently — all callers await the same promise.
 */
export async function initParser(): Promise<Parser> {
  if (parser) return parser
  if (!initPromise) {
    initPromise = (async () => {
      await Parser.init({
        locateFile: (filename: string) => {
          if (filename === 'tree-sitter.wasm') return '/tree-sitter.wasm'
          return filename
        },
      })
      const JavaScript = await Language.load('/tree-sitter-javascript.wasm')
      parser = new Parser()
      parser.setLanguage(JavaScript)
      return parser
    })()
  }
  return initPromise
}

/**
 * Parse a code string and return the tree-sitter Tree.
 * initParser() must have been called (and awaited) before this.
 */
export function parseCode(code: string): Tree {
  if (!parser) throw new Error('Parser not initialised — call initParser() first')
  return parser.parse(code) as Tree
}
