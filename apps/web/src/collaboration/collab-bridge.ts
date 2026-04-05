/**
 * collab-bridge.ts — Y.js ↔ Canvas synchronization bridge
 *
 * Direction: Y.js remote changes → canvas-store
 * (The other direction, canvas-store → Y.js, is handled in canvas-store.ts itself.)
 *
 * ECHO PREVENTION:
 * Local canvas writes to Y.js use `doc.transact(..., 'devkarm-local')` as origin.
 * This observer skips any event whose transaction origin is 'devkarm-local',
 * preventing echoes without needing an additional boolean flag.
 *
 * USAGE:
 *   const detach = attachCollabBridge(fileId)   // call after initCollab()
 *   // ... when leaving the project or switching files:
 *   detach()
 */

import type { Edge } from '@xyflow/react'
import { getYNodes, getYEdges, isCollabActive } from '../lib/collab'
import { useCanvasStore, type AppNode } from '../stores/canvas-store'

/** Active observer cleanup function. Replaced on every attachCollabBridge() call. */
let _cleanup: (() => void) | null = null

/**
 * Attach Y.js observers for a specific file.
 * Rebuilds the canvas from Y.js data whenever a remote peer makes changes.
 *
 * Returns a detach function — call it before switching files or leaving the project.
 */
export function attachCollabBridge(fileId: string): () => void {
  // Clean up any previously attached bridge
  detachCollabBridge()

  if (!isCollabActive()) {
    console.warn('[collab-bridge] Attempted to attach before initCollab()')
    return () => {}
  }

  const yNodes = getYNodes(fileId)
  const yEdges = getYEdges(fileId)

  /**
   * Rebuilds the full canvas from the current Y.js state.
   * Called whenever yNodes or yEdges changes from a remote peer.
   * Skips events originating from the local user ('devkarm-local').
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onYChange = (event: any) => {
    // Skip our own writes — they are already reflected in canvas-store
    if (event.transaction.origin === 'devkarm-local') return

    const nodes: AppNode[] = []
    yNodes.forEach((json: string) => {
      try { nodes.push(JSON.parse(json) as AppNode) } catch { /* skip malformed */ }
    })

    const edges: Edge[] = []
    yEdges.forEach((json: string) => {
      try { edges.push(JSON.parse(json) as Edge) } catch { /* skip malformed */ }
    })

    // syncFromCode preserves locally-dragged positions (via posMap) and
    // does NOT trigger graph→code, so it's safe to call from here.
    useCanvasStore.getState().syncFromCode(nodes, edges)
  }

  yNodes.observe(onYChange)
  yEdges.observe(onYChange)

  const detach = () => {
    yNodes.unobserve(onYChange)
    yEdges.unobserve(onYChange)
  }

  _cleanup = detach
  return detach
}

/**
 * Detach the currently active bridge (if any).
 * Safe to call even if no bridge is attached.
 */
export function detachCollabBridge(): void {
  _cleanup?.()
  _cleanup = null
}
