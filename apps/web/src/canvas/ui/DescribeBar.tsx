import { useState, useRef, type KeyboardEvent } from 'react'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { AI_ENABLED, describeToBlocks, type AiBlock } from '../../lib/ai'
import { useCanvasStore, type AppNode } from '../../stores/canvas-store'
import { graphToCode } from '../sync/graph-to-code'
import { useEditorStore } from '../../stores/editor-store'
import { useSyncStore } from '../../stores/sync-store'
import './DescribeBar.css'

// ── AI block → React Flow node ──────────────────────────────────────────────

function blockToNode(block: AiBlock, index: number, startY: number): AppNode | null {
  const x = 120
  const y = startY + index * 150

  if (block.type === 'function') {
    return {
      id: `fn-ai-${Date.now()}-${index}`,
      type: 'functionNode',
      position: { x, y },
      data: {
        name: block.name ?? 'unnamed',
        params: block.params ?? [],
        returnType: block.returnType ?? 'void',
        code: block.code ?? '',
      },
    }
  }

  if (block.type === 'variable') {
    return {
      id: `var-ai-${Date.now()}-${index}`,
      type: 'variableNode',
      position: { x, y },
      data: {
        name: block.name ?? 'unnamed',
        varType: 'const',
        value: block.value ?? '""',
      },
    }
  }

  if (block.type === 'api') {
    return {
      id: `api-ai-${Date.now()}-${index}`,
      type: 'apiNode',
      position: { x, y },
      data: {
        method: (block.method ?? 'GET') as import('../nodes/ApiNode').HttpMethod,
        path: block.url ?? '/',
        status: 'idle' as const,
      },
    } as AppNode
  }

  return null
}

// ── component ────────────────────────────────────────────────────────────────

export default function DescribeBar() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canvasStore = useCanvasStore()
  const editorStore = useEditorStore()
  const syncStore = useSyncStore()

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    try {
      const blocks = await describeToBlocks(trimmed)

      if (!Array.isArray(blocks) || blocks.length === 0) {
        setError('AI returned no nodes. Try a more specific description.')
        return
      }

      // Compute Y offset below the last existing node
      const currentNodes = canvasStore.nodes
      const maxY = currentNodes.reduce((m, n) => Math.max(m, n.position.y), 0)
      const startY = currentNodes.length > 0 ? maxY + 200 : 50

      const newNodes = blocks
        .map((b, i) => blockToNode(b, i, startY))
        .filter((n): n is AppNode => n !== null)

      // Merge into canvas store
      const merged = [...currentNodes, ...newNodes]

      syncStore.setSyncingFromGraph(true)
      canvasStore.syncFromCode(merged, canvasStore.edges)

      // Generate code and push to editor
      const code = graphToCode(merged)
      editorStore.setCodeSilent(code)
      syncStore.setSyncingFromGraph(false)

      setInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
    if (e.key === 'Escape') { setInput(''); setError(null) }
  }

  // ── no API key ──
  if (!AI_ENABLED) {
    return (
      <div className="describe-bar describe-bar--disabled">
        <AlertCircle size={14} className="describe-bar__icon--alert" />
        <span>Set <code>VITE_ANTHROPIC_API_KEY</code> in <code>.env</code> to enable AI features</span>
      </div>
    )
  }

  return (
    <div className="describe-bar">
      {error && (
        <div className="describe-bar__error">
          <AlertCircle size={12} />
          <span>{error}</span>
          <button className="describe-bar__error-close" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      <div className="describe-bar__row">
        <input
          ref={inputRef}
          className="describe-bar__input"
          placeholder="Describe what you want to build..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          className="describe-bar__send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          title="Send (Enter)"
        >
          {loading
            ? <Loader2 size={15} className="describe-bar__spinner" />
            : <Send size={15} />}
        </button>
      </div>
    </div>
  )
}
