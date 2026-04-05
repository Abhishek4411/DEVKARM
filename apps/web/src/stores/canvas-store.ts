import { create } from 'zustand'
import {
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react'
import type { FunctionNodeType } from '../canvas/nodes/FunctionNode'
import type { VariableNodeType } from '../canvas/nodes/VariableNode'
import type { ApiNodeType } from '../canvas/nodes/ApiNode'
import type { ConditionNodeType } from '../canvas/nodes/ConditionNode'
import type { LoopNodeType } from '../canvas/nodes/LoopNode'
import type { TryCatchNodeType } from '../canvas/nodes/TryCatchNode'
import type { CommentNodeType } from '../canvas/nodes/CommentNode'
import type { PackageNodeType } from '../canvas/nodes/PackageNode'
import type { DatabaseTableNodeType } from '../canvas/nodes/DatabaseTableNode'
import type { BugNodeType } from '../canvas/nodes/BugNode'
// sync-store has no local imports so it is safe to import directly (no circular dep)
import { useSyncStore } from './sync-store'
// collab.ts has no local imports — safe to import statically
import { isCollabActive, getDoc, getYNodes, getYEdges } from '../lib/collab'

export type AppNode = FunctionNodeType | VariableNodeType | ApiNodeType | ConditionNodeType | LoopNodeType | TryCatchNodeType | CommentNodeType | PackageNodeType | DatabaseTableNodeType | BugNodeType

// ── Lazy import for editor-store (avoids circular dep: editor-store → canvas-store) ──
function getEditorStore() {
  return import('./editor-store').then((m) => m.useEditorStore.getState())
}

// ── graph → code: run and push to editor, respecting sync locks ───────────────
async function triggerGraphToCode(nodes: AppNode[], edges: Edge[] = []) {
  // Synchronous guard BEFORE any async yield — prevents the race where runSync
  // clears isSyncingFromCode before a microtask-deferred check can see it.
  if (useSyncStore.getState().isSyncingFromCode) return

  const { graphToCode } = await import('../canvas/sync/graph-to-code')
  const code = graphToCode(nodes, edges)

  useSyncStore.getState().setSyncingFromGraph(true)
  try {
    const editor = await getEditorStore()
    editor.setCodeSilent(code)
  } finally {
    useSyncStore.getState().setSyncingFromGraph(false)
  }
}

// ── Y.js sync helpers ─────────────────────────────────────────────────────────
// All are no-ops if collab is not initialized. Writes use 'devkarm-local' as
// transact origin so the remote observer can distinguish echoes from real remote
// changes and skip them.

function yjsSetNode(node: AppNode, fileId: string): void {
  if (!isCollabActive()) return
  const doc = getDoc()
  if (!doc) return
  doc.transact(() => { getYNodes(fileId).set(node.id, JSON.stringify(node)) }, 'devkarm-local')
}

function yjsDeleteNode(nodeId: string, fileId: string): void {
  if (!isCollabActive()) return
  const doc = getDoc()
  if (!doc) return
  doc.transact(() => { getYNodes(fileId).delete(nodeId) }, 'devkarm-local')
}

function yjsSetEdge(edge: Edge, fileId: string): void {
  if (!isCollabActive()) return
  const doc = getDoc()
  if (!doc) return
  doc.transact(() => { getYEdges(fileId).set(edge.id, JSON.stringify(edge)) }, 'devkarm-local')
}

function yjsDeleteEdge(edgeId: string, fileId: string): void {
  if (!isCollabActive()) return
  const doc = getDoc()
  if (!doc) return
  doc.transact(() => { getYEdges(fileId).delete(edgeId) }, 'devkarm-local')
}

/** Full resync — used when code→graph regenerates the entire canvas. */
function yjsSyncFull(nodes: AppNode[], edges: Edge[], fileId: string): void {
  if (!isCollabActive()) return
  const doc = getDoc()
  if (!doc) return
  const yNodes = getYNodes(fileId)
  const yEdges = getYEdges(fileId)
  doc.transact(() => {
    const newNodeIds = new Set(nodes.map((n) => n.id))
    yNodes.forEach((_, id) => { if (!newNodeIds.has(id)) yNodes.delete(id) })
    for (const n of nodes) yNodes.set(n.id, JSON.stringify(n))
    const newEdgeIds = new Set(edges.map((e) => e.id))
    yEdges.forEach((_, id) => { if (!newEdgeIds.has(id)) yEdges.delete(id) })
    for (const e of edges) yEdges.set(e.id, JSON.stringify(e))
  }, 'devkarm-local')
}

// ── AppNode → IGC format (for persistence) ───────────────────────────────────
function appNodeToIgc(node: AppNode) {
  const graph = { x: node.position.x, y: node.position.y }

  if (node.type === 'functionNode') {
    const d = node.data as { name: string; params: string[]; returnType: string; code: string }
    return {
      id: node.id,
      node_type: 'function',
      graph,
      intent: {},
      code: { name: d.name, params: d.params, returnType: d.returnType, body: d.code },
    }
  }
  if (node.type === 'variableNode') {
    const d = node.data as { name: string; varType: string; value: string }
    return {
      id: node.id,
      node_type: 'variable',
      graph,
      intent: {},
      code: { name: d.name, varType: d.varType, value: d.value },
    }
  }
  if (node.type === 'conditionNode') {
    const d = node.data as { condition: string }
    return {
      id: node.id,
      node_type: 'condition',
      graph,
      intent: {},
      code: { condition: d.condition },
    }
  }
  if (node.type === 'loopNode') {
    const d = node.data as { loopKind: string; expression: string }
    return {
      id: node.id,
      node_type: 'loop',
      graph,
      intent: {},
      code: { loopKind: d.loopKind, expression: d.expression },
    }
  }
  if (node.type === 'tryCatchNode') {
    const d = node.data as { errorVar: string }
    return {
      id: node.id,
      node_type: 'tryCatch',
      graph,
      intent: {},
      code: { errorVar: d.errorVar },
    }
  }
  if (node.type === 'commentNode') {
    const d = node.data as { text: string; width: number }
    return {
      id: node.id,
      node_type: 'comment',
      graph,
      intent: {},
      code: { text: d.text, width: d.width },
    }
  }
  // apiNode
  const d = node.data as { method: string; path: string }
  return {
    id: node.id,
    node_type: 'api',
    graph,
    intent: {},
    code: { method: d.method, path: d.path },
  }
}

// ── React Flow Edge → IGC Edge format ────────────────────────────────────────
function flowEdgeToIgc(edge: Edge) {
  return {
    id: edge.id,
    source_node_id: edge.source,
    source_port_id: edge.sourceHandle ?? 'default',
    target_node_id: edge.target,
    target_port_id: edge.targetHandle ?? 'default',
    edge_type: 'data',
  }
}

// ── Store interface ───────────────────────────────────────────────────────────
interface CanvasState {
  nodes: AppNode[]
  edges: Edge[]
  dirty: boolean
  currentProjectId: string | null
  currentFileId: string | null
  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect
  syncFromCode: (nodes: AppNode[], edges: Edge[]) => void
  loadCanvas: (nodes: AppNode[], edges: Edge[]) => void
  setCurrentProject: (id: string) => void
  setCurrentFile: (id: string | null) => void
  saveToBackend: () => Promise<void>
  updateNodeData: (id: string, data: Partial<AppNode['data']>) => void
  addNode: (node: AppNode) => void
  deleteNode: (id: string) => void
  clearCanvas: () => void
  /** Batch-update node positions (from auto-layout). Does NOT trigger graph-to-code. */
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void
  /** Exposed so App.tsx's onDelete handler can regenerate code after keyboard deletion. */
  triggerGraphToCode: () => void
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  edges: [],
  dirty: false,
  currentProjectId: null,
  currentFileId: null,

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }))

    // Mark dirty on position moves, add, remove, replace.
    // Skip 'select' and 'dimensions' — React Flow internal bookkeeping only.
    const makesDirty = changes.some(
      (c) => c.type === 'position' || c.type === 'remove' || c.type === 'add' || c.type === 'replace',
    )
    if (makesDirty) set({ dirty: true })

    // Y.js: surgical sync for position + remove changes
    const fileId = get().currentFileId
    if (fileId) {
      const updatedNodes = get().nodes
      for (const change of changes) {
        if (change.type === 'position') {
          const node = updatedNodes.find((n) => n.id === change.id)
          if (node) yjsSetNode(node, fileId)
        } else if (change.type === 'remove') {
          yjsDeleteNode(change.id, fileId)
        }
      }
    }

    // NEVER call triggerGraphToCode here. Any change event (add/replace) fired
    // after syncFromCode causes the formatter loop. Keyboard deletion is handled
    // by the onDelete prop on <ReactFlow>; programmatic deletion by deleteNode.
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
      set({ dirty: true })
    }
    // Y.js: remove deleted edges
    const fileId = get().currentFileId
    if (fileId) {
      for (const change of changes) {
        if (change.type === 'remove') yjsDeleteEdge(change.id, fileId)
      }
    }
    // NEVER call triggerGraphToCode here — same reason as onNodesChange.
    // onConnect handles user-drawn edges; onDelete handles keyboard removal.
  },

  onConnect: (connection) => {
    set((state) => ({ edges: addEdge(connection, state.edges), dirty: true }))
    triggerGraphToCode(get().nodes, get().edges)
    // Y.js: write the new edge
    const fileId = get().currentFileId
    if (fileId) {
      const newEdge = get().edges.find((e) => e.source === connection.source && e.target === connection.target)
      if (newEdge) yjsSetEdge(newEdge, fileId)
    }
  },

  // Called by code→graph pipeline — does NOT set dirty (code is source of truth in that direction).
  syncFromCode: (newNodes, newEdges) => {
    set((state) => {
      const posMap = new Map(state.nodes.map((n) => [n.id, n.position]))
      const nodes = newNodes.map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? n.position,
      }))
      return { nodes, edges: newEdges }
    })
    // Y.js: full resync since code→graph may have added/removed/changed many nodes
    const fileId = get().currentFileId
    if (fileId) yjsSyncFull(get().nodes, get().edges, fileId)
  },

  // Called on project load — bypasses graph→code sync, does NOT set dirty.
  loadCanvas: (nodes, edges) => set({ nodes, edges, dirty: false }),

  // Called by App.tsx when a project is selected.
  setCurrentProject: (id) => set({ currentProjectId: id }),

  // Called when the active file tab changes.
  setCurrentFile: (id) => set({ currentFileId: id }),

  // Batch upsert: DELETE all for project, then re-INSERT with preserved IDs.
  saveToBackend: async () => {
    const { nodes, edges, currentProjectId } = get()
    if (!currentProjectId) return

    const { deleteAllNodes, saveNode, saveEdge } = await import('../lib/api')

    // DELETE all nodes (FK cascade removes edges too)
    await deleteAllNodes(currentProjectId)

    // INSERT nodes sequentially (avoids parent_id FK violations on nested nodes)
    for (const node of nodes) {
      await saveNode(currentProjectId, appNodeToIgc(node))
    }

    // INSERT edges (nodes now exist so FKs are safe)
    for (const edge of edges) {
      await saveEdge(currentProjectId, flowEdgeToIgc(edge))
    }

    set({ dirty: false })
  },

  updateNodeData: (id, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? ({ ...n, data: { ...n.data, ...data } } as AppNode) : n,
      ),
      dirty: true,
    }))
    triggerGraphToCode(get().nodes, get().edges)
    const fileId = get().currentFileId
    if (fileId) {
      const updated = get().nodes.find((n) => n.id === id)
      if (updated) yjsSetNode(updated, fileId)
    }
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node], dirty: true }))
    triggerGraphToCode(get().nodes, get().edges)
    const fileId = get().currentFileId
    if (fileId) yjsSetNode(node, fileId)
  },

  deleteNode: (id) => {
    // Capture edges to delete before state update
    const edgesToDelete = get().edges.filter((e) => e.source === id || e.target === id)
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      dirty: true,
    }))
    triggerGraphToCode(get().nodes, get().edges)
    const fileId = get().currentFileId
    if (fileId) {
      yjsDeleteNode(id, fileId)
      for (const e of edgesToDelete) yjsDeleteEdge(e.id, fileId)
    }
  },

  clearCanvas: () => {
    const fileId = get().currentFileId
    set({ nodes: [], edges: [], dirty: true })
    triggerGraphToCode([], [])
    if (fileId) yjsSyncFull([], [], fileId)
  },

  applyLayout: (positions) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        const pos = positions.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
      dirty: true,
    })),

  // Called by App.tsx onDelete (keyboard Delete/Backspace) after React Flow has
  // already applied the deletion to its internal state via onNodesChange.
  triggerGraphToCode: () => triggerGraphToCode(get().nodes, get().edges),
}))
