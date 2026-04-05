import { useEffect } from 'react'
import type { NodeReplayState } from './types'
import './NodeHighlighter.css'

interface Props {
  nodeStates: Map<string, NodeReplayState>
  activeNodeId: string | null
  activeTooltip: { nodeId: string; inputData?: Record<string, unknown>; outputData?: Record<string, unknown>; durationMs?: number; errorMessage?: string } | null
}

/** Injects CSS classes onto React Flow node DOM elements to show replay state. */
export default function NodeHighlighter({ nodeStates, activeNodeId, activeTooltip }: Props) {
  useEffect(() => {
    // Apply/remove highlight classes on React Flow node wrappers
    nodeStates.forEach((state, nodeId) => {
      const el = document.querySelector(`[data-id="${nodeId}"]`) as HTMLElement | null
      if (!el) return
      el.classList.remove('dbg-active', 'dbg-done', 'dbg-error')
      if (state === 'active') el.classList.add('dbg-active')
      else if (state === 'done') el.classList.add('dbg-done')
      else if (state === 'error') el.classList.add('dbg-error')
    })
  }, [nodeStates])

  // Cleanup all classes on unmount
  useEffect(() => {
    return () => {
      document.querySelectorAll('[data-id]').forEach((el) => {
        el.classList.remove('dbg-active', 'dbg-done', 'dbg-error')
      })
    }
  }, [])

  if (!activeTooltip || !activeNodeId) return null

  // Find node position in the DOM to anchor the tooltip
  const nodeEl = document.querySelector(`[data-id="${activeNodeId}"]`) as HTMLElement | null
  if (!nodeEl) return null

  const rect = nodeEl.getBoundingClientRect()

  return (
    <div
      className="dbg-tooltip"
      style={{ top: rect.top - 8, left: rect.right + 12 }}
    >
      {activeTooltip.errorMessage ? (
        <>
          <div className="dbg-tooltip__title dbg-tooltip__title--error">Error</div>
          <div className="dbg-tooltip__error">{activeTooltip.errorMessage}</div>
        </>
      ) : (
        <>
          {activeTooltip.inputData && Object.keys(activeTooltip.inputData).length > 0 && (
            <div className="dbg-tooltip__section">
              <div className="dbg-tooltip__label">Input</div>
              <pre className="dbg-tooltip__json">{JSON.stringify(activeTooltip.inputData, null, 2)}</pre>
            </div>
          )}
          {activeTooltip.outputData && Object.keys(activeTooltip.outputData).length > 0 && (
            <div className="dbg-tooltip__section">
              <div className="dbg-tooltip__label">Output</div>
              <pre className="dbg-tooltip__json">{JSON.stringify(activeTooltip.outputData, null, 2)}</pre>
            </div>
          )}
          {activeTooltip.durationMs !== undefined && (
            <div className="dbg-tooltip__duration">{activeTooltip.durationMs.toFixed(1)} ms</div>
          )}
        </>
      )}
    </div>
  )
}
