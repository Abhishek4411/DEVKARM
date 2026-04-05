import { create } from 'zustand'
import { initParser, parseCode } from '../lib/parser'
import { codeToGraph } from '../canvas/sync/code-to-graph'
import { useCanvasStore } from './canvas-store'
import { useSyncStore } from './sync-store'

export const DEFAULT_CODE = `// Start coding or drag nodes onto the canvas...\n`

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export async function runSync(code: string) {
  const sync = useSyncStore.getState()
  // Don't parse while graph→code is writing to us — would create a ping-pong.
  if (sync.isSyncingFromGraph) return
  sync.setSyncingFromCode(true)
  try {
    await initParser()
    const tree = parseCode(code)
    const { nodes, edges } = codeToGraph(tree)
    useCanvasStore.getState().syncFromCode(nodes, edges)
  } catch (err) {
    console.warn('[trinity-sync] parse failed:', err)
  } finally {
    // Delay lock release by 200ms — covers React Flow's async render + event
    // cycle so any dimension/layout onNodesChange events see the flag still set.
    setTimeout(() => useSyncStore.getState().setSyncingFromCode(false), 200)
  }
}

interface EditorState {
  code: string
  /** Normal setter — debounces and triggers code→graph parse. */
  setCode: (code: string) => void
  /** Silent setter — updates store only, no parse (used by graph→code). */
  setCodeSilent: (code: string) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  code: DEFAULT_CODE,

  setCode: (code) => {
    // Skip if graph→code is currently writing to us (prevents loop)
    if (useSyncStore.getState().isSyncingFromGraph) return
    set({ code })
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => runSync(code), 500)
  },

  setCodeSilent: (code) => set({ code }),
}))
