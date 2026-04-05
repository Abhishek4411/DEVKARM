import type { Edge } from '@xyflow/react'
import type { AppNode } from '../../stores/canvas-store'
import type { FunctionNodeData } from '../nodes/FunctionNode'
import type { VariableNodeData } from '../nodes/VariableNode'
import type { ApiNodeData } from '../nodes/ApiNode'
import type { ConditionNodeData } from '../nodes/ConditionNode'
import type { LoopNodeData } from '../nodes/LoopNode'
import type { TryCatchNodeData } from '../nodes/TryCatchNode'

// ── generators ────────────────────────────────────────────────────────────────

function genFunction(data: FunctionNodeData): string {
  const params = data.params.join(', ')
  const body = data.code.trim()
  // Emit plain JavaScript — no TypeScript return-type annotation.
  // returnType lives in node metadata for display only.
  return `function ${data.name}(${params}) {\n  ${body}\n}`
}

function genVariable(data: VariableNodeData): string {
  return `${data.varType} ${data.name} = ${data.value};`
}

function toIdentifier(raw: string, fallback: string): string {
  // Strip non-identifier characters, then ensure it doesn't start with a digit
  const cleaned = raw.replace(/[^a-zA-Z0-9_$]/g, '_').replace(/^(\d)/, '_$1')
  return cleaned || fallback
}

function genApi(data: ApiNodeData, index: number): string {
  const rawSegment = data.path.split('/').filter(Boolean).pop() ?? `endpoint${index}`
  const name = toIdentifier(rawSegment, `endpoint${index}`)
  return `const ${name}Response = await fetch('${data.path}');`
}

function genLoop(data: LoopNodeData): string {
  const expr = data.expression || '/* expression */'
  switch (data.loopKind) {
    case 'for':
      return `for (${expr}) {\n  // loop body\n}`
    case 'while':
      return `while (${expr}) {\n  // loop body\n}`
    case 'forEach':
      // expression is e.g. "item of items" or "key in obj"
      return `for (${expr}) {\n  // loop body\n}`
    default:
      return `for (${expr}) {\n  // loop body\n}`
  }
}

function genTryCatch(data: TryCatchNodeData, nodeId: string, nodes: AppNode[], edges: Edge[]): string {
  const errVar = data.errorVar || 'error'

  const successEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === 'success')
  const errorEdge   = edges.find((e) => e.source === nodeId && e.sourceHandle === 'error')

  const successNode = successEdge ? nodes.find((n) => n.id === successEdge.target) : undefined
  const errorNode   = errorEdge   ? nodes.find((n) => n.id === errorEdge.target)   : undefined

  const tryBody   = successNode ? nodeToLine(successNode, nodes, edges) : '  // try body'
  const catchBody = errorNode   ? nodeToLine(errorNode,   nodes, edges) : `  // handle ${errVar}`

  return `try {\n${tryBody}\n} catch (${errVar}) {\n${catchBody}\n}`
}

function genCondition(data: ConditionNodeData, nodeId: string, nodes: AppNode[], edges: Edge[]): string {
  const cond = data.condition || 'condition'

  // Find nodes connected via the true/false source handles
  const trueEdge  = edges.find((e) => e.source === nodeId && e.sourceHandle === 'true')
  const falseEdge = edges.find((e) => e.source === nodeId && e.sourceHandle === 'false')

  const trueNode  = trueEdge  ? nodes.find((n) => n.id === trueEdge.target)  : undefined
  const falseNode = falseEdge ? nodes.find((n) => n.id === falseEdge.target) : undefined

  const trueBranch  = trueNode  ? nodeToLine(trueNode,  nodes, edges) : '  // true branch'
  const falseBranch = falseNode ? nodeToLine(falseNode, nodes, edges) : '  // false branch'

  return `if (${cond}) {\n${trueBranch}\n} else {\n${falseBranch}\n}`
}

/** Generate a single indented line for a node used inside a branch. */
function nodeToLine(node: AppNode, nodes: AppNode[], edges: Edge[]): string {
  switch (node.type) {
    case 'variableNode': return `  ${genVariable(node.data as VariableNodeData)}`
    case 'functionNode': {
      const d = node.data as FunctionNodeData
      return `  ${d.name}(${d.params.join(', ')})`
    }
    case 'apiNode': {
      const d = node.data as ApiNodeData
      return `  await fetch('${d.path}')`
    }
    case 'loopNode':
      return genLoop(node.data as LoopNodeData)
        .split('\n').map((l) => `  ${l}`).join('\n')
    case 'tryCatchNode':
      return genTryCatch(node.data as TryCatchNodeData, node.id, nodes, edges)
        .split('\n').map((l) => `  ${l}`).join('\n')
    case 'conditionNode':
      return genCondition(node.data as ConditionNodeData, node.id, nodes, edges)
        .split('\n').map((l) => `  ${l}`).join('\n')
    default:
      return '  // branch'
  }
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Convert React Flow nodes back into source code.
 * Order: variables → functions → API calls → conditions.
 * Edges are used to resolve true/false branch content for condition nodes.
 */
export function graphToCode(nodes: AppNode[], edges: Edge[] = []): string {
  const variables:   string[] = []
  const functions:   string[] = []
  const apiCalls:    string[] = []
  const loops:       string[] = []
  const tryCatches:  string[] = []
  const conditions:  string[] = []

  // IDs of nodes that are branch targets — skip them at top level
  const branchTargetIds = new Set(
    edges
      .filter((e) => e.sourceHandle === 'true' || e.sourceHandle === 'false')
      .map((e) => e.target),
  )

  let apiIndex = 0

  for (const node of nodes) {
    // Nodes consumed as branch content are not emitted at the top level
    if (branchTargetIds.has(node.id)) continue

    switch (node.type) {
      case 'variableNode':
        variables.push(genVariable(node.data as VariableNodeData))
        break
      case 'functionNode':
        functions.push(genFunction(node.data as FunctionNodeData))
        break
      case 'apiNode':
        apiCalls.push(genApi(node.data as ApiNodeData, apiIndex++))
        break
      case 'loopNode':
        loops.push(genLoop(node.data as LoopNodeData))
        break
      case 'tryCatchNode':
        tryCatches.push(genTryCatch(node.data as TryCatchNodeData, node.id, nodes, edges))
        break
      case 'conditionNode':
        conditions.push(genCondition(node.data as ConditionNodeData, node.id, nodes, edges))
        break
    }
  }

  return [...variables, ...functions, ...apiCalls, ...loops, ...tryCatches, ...conditions].join('\n\n')
}
