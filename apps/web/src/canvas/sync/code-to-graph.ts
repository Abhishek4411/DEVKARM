import type { Edge } from '@xyflow/react'
import type { Tree, Node as TSNode } from 'web-tree-sitter'
import type { AppNode } from '../../stores/canvas-store'

import { applyOrganicLayout } from './organic-layout'

const X_POS = 400
const Y_START = 300
const Y_GAP = 0

// ── helpers ───────────────────────────────────────────────────────────────────

function extractParams(paramsNode: TSNode | null): string[] {
  if (!paramsNode) return []
  // formal_parameters children: '(' identifier ',' identifier ')'
  // filter out punctuation with isNamed
  return paramsNode.children
    .filter((c) => c.isNamed)
    .map((c) => c.text)
}

function extractKind(declNode: TSNode): string {
  // first named child of lexical_declaration is the keyword: const | let | var
  return declNode.children.find(
    (c) => c.type === 'const' || c.type === 'let' || c.type === 'var',
  )?.text ?? 'const'
}

// ── main export ───────────────────────────────────────────────────────────────

export function codeToGraph(tree: Tree): { nodes: AppNode[]; edges: Edge[] } {
  const nodes: AppNode[] = []
  const edges: Edge[] = []

  // fnName → nodeId, used for edge inference
  const functionIds = new Map<string, string>()

  let y = Y_START

  for (const child of tree.rootNode.children) {
    // Skip tree-sitter ERROR/MISSING nodes (produced by incomplete / invalid
    // syntax while the user is mid-type) to avoid crashing and dropping nodes.
    if (child.type === 'ERROR' || child.type === 'MISSING') continue

    const t = child.type

    try {

    // ── function_declaration ──────────────────────────────────────────────────
    if (t === 'function_declaration') {
      const name = child.childForFieldName('name')?.text
      if (!name) continue

      const params = extractParams(child.childForFieldName('parameters'))
      const id = `fn-${name}`
      functionIds.set(name, id)

      // Extract only the body content (strip outer braces) so graph→code
      // doesn't wrap it in a second function declaration on the next round-trip.
      const bodyNode = child.childForFieldName('body')
      const rawBody = bodyNode?.text ?? '{}'
      const code = rawBody.slice(1, -1).trim()

      nodes.push({
        id,
        type: 'functionNode',
        position: { x: X_POS, y },
        data: { name, params, returnType: '', code },
      })
      y += Y_GAP
    }

    // ── const / let / var declaration ─────────────────────────────────────────
    else if (t === 'lexical_declaration' || t === 'variable_declaration') {
      const kind = extractKind(child)

      for (const declarator of child.children) {
        if (declarator.type !== 'variable_declarator') continue

        const varName = declarator.childForFieldName('name')?.text
        if (!varName) continue

        const value = declarator.childForFieldName('value')?.text ?? ''
        const id = `var-${varName}`

        nodes.push({
          id,
          type: 'variableNode',
          position: { x: X_POS, y },
          data: { name: varName, varType: kind, value },
        })
        y += Y_GAP
      }
    }

    // ── try_statement ─────────────────────────────────────────────────────────
    else if (t === 'try_statement') {
      // Extract the catch clause parameter name if present
      const catchClause = child.children.find((c) => c.type === 'catch_clause')
      const paramNode   = catchClause?.childForFieldName('parameter')
      const errorVar    = paramNode?.text ?? 'error'

      const id = `tc-${errorVar}-${y}`

      nodes.push({
        id,
        type: 'tryCatchNode',
        position: { x: X_POS, y },
        data: { errorVar },
      })
      y += Y_GAP
    }

    // ── loop statements ───────────────────────────────────────────────────────
    else if (t === 'for_statement' || t === 'while_statement' || t === 'for_in_statement') {
      let loopKind: 'for' | 'while' | 'forEach' = 'for'
      let expression = ''

      if (t === 'for_statement') {
        loopKind = 'for'
        // Reconstruct the for-header from initializer / condition / increment fields
        const init      = child.childForFieldName('initializer')?.text  ?? ''
        const cond      = child.childForFieldName('condition')?.text    ?? ''
        const increment = child.childForFieldName('increment')?.text    ?? ''
        expression = [init, cond, increment].filter(Boolean).join('; ')
      } else if (t === 'while_statement') {
        loopKind = 'while'
        const condNode = child.childForFieldName('condition')
        const raw = condNode?.text ?? ''
        expression = raw.replace(/^\(/, '').replace(/\)$/, '').trim()
      } else if (t === 'for_in_statement') {
        // covers both for..in and for..of
        loopKind = 'forEach'
        const left  = child.childForFieldName('left')?.text  ?? ''
        const right = child.childForFieldName('right')?.text ?? ''
        const kind  = child.children.find((c) => c.type === 'of' || c.type === 'in')?.type ?? 'of'
        expression = `${left} ${kind} ${right}`
      }

      const safeExpr = expression.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const id = `loop-${safeExpr || Date.now()}`

      nodes.push({
        id,
        type: 'loopNode',
        position: { x: X_POS, y },
        data: { loopKind, expression },
      })
      y += Y_GAP
    }

    // ── if_statement ──────────────────────────────────────────────────────────
    else if (t === 'if_statement') {
      const condNode = child.childForFieldName('condition')
      // condition field includes the surrounding parens — strip them
      const raw = condNode?.text ?? ''
      const condition = raw.replace(/^\(/, '').replace(/\)$/, '').trim()
      const id = `cond-${condition.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || Date.now()}`

      nodes.push({
        id,
        type: 'conditionNode',
        position: { x: X_POS, y },
        data: { condition },
      })
      y += Y_GAP
    }

    // ── top-level fetch / axios call ──────────────────────────────────────────
    else if (t === 'expression_statement') {
      const expr = child.firstChild
      if (!expr || expr.type !== 'call_expression') continue

      const callee = expr.childForFieldName('function')?.text ?? ''
      if (!callee.includes('fetch') && !callee.includes('axios')) continue

      const argsNode = expr.childForFieldName('arguments')
      const pathArg = argsNode?.children.find(
        (c) => c.type === 'string' || c.type === 'template_string',
      )
      const path = pathArg?.text.replace(/[`'"]/g, '') ?? '/api'
      // Use path-based id so the same endpoint keeps the same id across re-parses,
      // preserving the user's dragged position in syncFromCode's posMap.
      const id = `api-${path.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`

      nodes.push({
        id,
        type: 'apiNode',
        position: { x: X_POS, y },
        data: { method: 'GET', path, status: 'idle' },
      })
      y += Y_GAP
    }

    } catch { continue } // fault-tolerant: skip any node that throws during extraction
  }

  // ── edge inference: variable value references a known function name ─────────
  const edgeTypes = ['default', 'straight', 'step']
  try {
    for (const node of nodes) {
      if (node.type !== 'variableNode') continue
      const value = (node.data as { value: string }).value

      for (const [fnName, fnId] of functionIds) {
        if (value.includes(fnName)) {
          const edgeType = edgeTypes[Math.floor(Math.random() * edgeTypes.length)]
          edges.push({
            id: `e-${fnId}-${node.id}`,
            source: fnId,
            target: node.id,
            targetHandle: 'target',
            type: edgeType,
            // No `animated: true` — AnimatedEdge already runs the SMIL animation;
            // adding this flag would layer React Flow's CSS dash on top.
            style: { stroke: '#3B82F6' },
          })
        }
      }
    }
  } catch (err) {
    console.error('[trinity-sync] Edge inference failed:', err)
  }

  // ── organic layout ────────────────────────────────────────────────────────
  const organicNodes = applyOrganicLayout(nodes, edges)

  return { nodes: organicNodes, edges }
}


