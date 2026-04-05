/**
 * semantic-snap.ts
 * Connection validation rules for the DEVKARM canvas.
 *
 * isValidConnection is called by React Flow's isValidConnection prop.
 * It receives the node types of source and target and returns whether
 * the connection is semantically meaningful.
 */

export interface ConnectionValidity {
  valid: boolean
  reason?: string
}

/** All node types that participate in code generation (have semantic meaning). */
const CODE_NODES = new Set([
  'functionNode',
  'variableNode',
  'apiNode',
  'conditionNode',
  'loopNode',
  'tryCatchNode',
])

/**
 * Validate a proposed connection.
 *
 * @param sourceType  - node type of the source (output) node
 * @param targetType  - node type of the target (input) node
 * @param sourceId    - id of the source node
 * @param targetId    - id of the target node
 * @param sourceHandle - handle id on the source (null = default)
 * @param targetHandle - handle id on the target (null = default)
 */
export function checkConnection(
  sourceType: string | undefined,
  targetType: string | undefined,
  sourceId: string,
  targetId: string,
  _sourceHandle?: string | null,
  _targetHandle?: string | null,
): ConnectionValidity {
  // Self-loops are never valid
  if (sourceId === targetId) {
    return { valid: false, reason: 'Cannot connect a node to itself.' }
  }

  // Comment nodes cannot connect to or from anything
  if (sourceType === 'commentNode') {
    return { valid: false, reason: 'Note nodes are canvas-only — they cannot connect to other nodes.' }
  }
  if (targetType === 'commentNode') {
    return { valid: false, reason: 'Note nodes are canvas-only — they cannot receive connections.' }
  }

  // Both nodes must exist (unknown type guard)
  if (!sourceType || !targetType) {
    return { valid: false, reason: 'Unknown node type.' }
  }

  // ── Explicit allow-list ────────────────────────────────────────────────────

  // Function → Variable  (function returns a value stored in variable)
  if (sourceType === 'functionNode' && targetType === 'variableNode') {
    return { valid: true }
  }
  // Variable → Function  (passing variable as parameter)
  if (sourceType === 'variableNode' && targetType === 'functionNode') {
    return { valid: true }
  }
  // Function → API  (composing: function result passed to API)
  if (sourceType === 'functionNode' && targetType === 'apiNode') {
    return { valid: true }
  }
  // API → Variable  (storing API response in a variable)
  if (sourceType === 'apiNode' && targetType === 'variableNode') {
    return { valid: true }
  }
  // Variable → API  (using variable as API path/body)
  if (sourceType === 'variableNode' && targetType === 'apiNode') {
    return { valid: true }
  }
  // Any code node → Condition  (condition depends on some value)
  if (CODE_NODES.has(sourceType) && targetType === 'conditionNode') {
    return { valid: true }
  }
  // Condition branches → any code node  (branch body)
  if (sourceType === 'conditionNode' && CODE_NODES.has(targetType)) {
    return { valid: true }
  }
  // Any code node → Loop  (loop depends on some value)
  if (CODE_NODES.has(sourceType) && targetType === 'loopNode') {
    return { valid: true }
  }
  // Loop → any code node  (loop body)
  if (sourceType === 'loopNode' && CODE_NODES.has(targetType)) {
    return { valid: true }
  }
  // Any code node → TryCatch  (wrap a node in error handling)
  if (CODE_NODES.has(sourceType) && targetType === 'tryCatchNode') {
    return { valid: true }
  }
  // TryCatch branches → any code node  (success/error body)
  if (sourceType === 'tryCatchNode' && CODE_NODES.has(targetType)) {
    return { valid: true }
  }
  // Function → Function  (one function calls another)
  if (sourceType === 'functionNode' && targetType === 'functionNode') {
    return { valid: true }
  }

  // ── Everything else is invalid ─────────────────────────────────────────────
  return {
    valid: false,
    reason: `${friendlyName(sourceType)} → ${friendlyName(targetType)} is not a meaningful connection.`,
  }
}

function friendlyName(type: string): string {
  const map: Record<string, string> = {
    functionNode:  'Function',
    variableNode:  'Variable',
    apiNode:       'API Call',
    conditionNode: 'Condition',
    loopNode:      'Loop',
    tryCatchNode:  'Try-Catch',
    commentNode:   'Note',
  }
  return map[type] ?? type
}
