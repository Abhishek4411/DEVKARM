import dagre from '@dagrejs/dagre'
import type { Edge } from '@xyflow/react'
import type { AppNode } from '../../stores/canvas-store'

/** Default pixel dimensions used for each node type when dagre sizes the graph. */
const NODE_DIMS: Record<string, { width: number; height: number }> = {
  functionNode:  { width: 220, height: 100 },
  variableNode:  { width: 200, height:  80 },
  apiNode:       { width: 220, height:  90 },
  conditionNode: { width: 200, height:  90 },
  loopNode:      { width: 200, height:  80 },
  tryCatchNode:  { width: 180, height:  80 },
  commentNode:   { width: 200, height: 100 },
}
const FALLBACK_DIMS = { width: 220, height: 90 }

export interface LayoutResult {
  /** Map from node id → new { x, y } top-left position. */
  positions: Map<string, { x: number; y: number }>
}

/**
 * Run a dagre TB (top-to-bottom) hierarchical layout over the given nodes/edges.
 * Returns a Map of node id → new position. Nodes not in the graph (e.g. isolated
 * comments) are kept at their current position.
 */
export function computeAutoLayout(
  nodes: AppNode[],
  edges: Edge[],
  options: {
    direction?: 'TB' | 'LR' | 'BT' | 'RL'
    nodeSepX?: number
    rankSep?: number
  } = {},
): LayoutResult {
  const {
    direction = 'TB',
    nodeSepX  = 80,
    rankSep   = 120,
  } = options

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSepX,
    ranksep: rankSep,
    marginx: 48,
    marginy: 48,
  })

  // Register nodes
  for (const node of nodes) {
    const dims = NODE_DIMS[node.type ?? ''] ?? FALLBACK_DIMS
    // CommentNode can have a user-set width
    const width = node.type === 'commentNode'
      ? ((node.data as { width?: number }).width ?? dims.width)
      : dims.width
    g.setNode(node.id, { width, height: dims.height })
  }

  // Register edges (only between nodes we know about)
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  for (const node of nodes) {
    const laid = g.node(node.id)
    if (laid) {
      // dagre gives center coordinates; React Flow wants top-left
      const dims = NODE_DIMS[node.type ?? ''] ?? FALLBACK_DIMS
      const w = node.type === 'commentNode'
        ? ((node.data as { width?: number }).width ?? dims.width)
        : dims.width
      positions.set(node.id, {
        x: Math.round(laid.x - w / 2),
        y: Math.round(laid.y - dims.height / 2),
      })
    } else {
      // Keep current position for any node dagre didn't place
      positions.set(node.id, { x: node.position.x, y: node.position.y })
    }
  }

  return { positions }
}
