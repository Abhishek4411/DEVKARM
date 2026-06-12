import type { Edge } from '@xyflow/react'
import type { Tree, Node as TSNode } from 'web-tree-sitter'
import type { AppNode } from '../../stores/canvas-store'
import type { FileDependency } from '../../stores/file-store'

import { applyOrganicLayout } from './organic-layout'

const X_POS = 400
const Y_START = 300
const Y_GAP = 0

// ── helpers ───────────────────────────────────────────────────────────────────

function extractParams(paramsNode: TSNode | null): string[] {
  if (!paramsNode) return []
  return paramsNode.children
    .filter((c) => c.isNamed)
    .map((c) => c.text)
}

function extractKind(declNode: TSNode): string {
  return declNode.children.find(
    (c) => c.type === 'const' || c.type === 'let' || c.type === 'var',
  )?.text ?? 'const'
}

// ── import/require detection ──────────────────────────────────────────────────

/** Extract imported symbols and source path from an import_statement AST node. */
function extractImportDeps(node: TSNode): FileDependency[] {
  const deps: FileDependency[] = []

  // ESM: import { a, b } from './module'  OR  import x from './module'
  const sourceNode = node.childForFieldName('source')
  if (!sourceNode) return deps

  const fromPath = sourceNode.text.replace(/['"]/g, '')

  // Named imports: import_clause → named_imports → import_specifier[]
  const importClause = node.children.find((c) => c.type === 'import_clause')
  if (importClause) {
    // Default import: import Foo from '...'
    const defaultImport = importClause.children.find((c) => c.type === 'identifier')
    if (defaultImport) {
      deps.push({ importedSymbol: defaultImport.text, fromPath })
    }

    // Named imports: import { a, b } from '...'
    const namedImports = importClause.children.find((c) => c.type === 'named_imports')
    if (namedImports) {
      for (const spec of namedImports.children) {
        if (spec.type === 'import_specifier') {
          const name = spec.childForFieldName('name')?.text ?? spec.text
          deps.push({ importedSymbol: name, fromPath })
        }
      }
    }

    // Namespace import: import * as Foo from '...'
    const namespaceImport = importClause.children.find((c) => c.type === 'namespace_import')
    if (namespaceImport) {
      const alias = namespaceImport.children.find((c) => c.type === 'identifier')
      deps.push({ importedSymbol: alias?.text ?? '*', fromPath })
    }
  }

  // Fallback: side-effect import
  if (deps.length === 0) {
    deps.push({ importedSymbol: '*', fromPath })
  }

  return deps
}

/** Extract require() call from a variable declaration. */
function extractRequireDeps(declNode: TSNode): FileDependency[] {
  const deps: FileDependency[] = []

  for (const child of declNode.children) {
    if (child.type !== 'variable_declarator') continue

    const varName = child.childForFieldName('name')?.text
    const value = child.childForFieldName('value')

    if (!value || value.type !== 'call_expression') continue
    const callee = value.childForFieldName('function')?.text
    if (callee !== 'require') continue

    const argsNode = value.childForFieldName('arguments')
    const pathArg = argsNode?.children.find(
      (c) => c.type === 'string' || c.type === 'template_string',
    )
    if (!pathArg) continue

    const fromPath = pathArg.text.replace(/[`'"]/g, '')
    deps.push({ importedSymbol: varName ?? '*', fromPath })
  }

  return deps
}

// ── main export ───────────────────────────────────────────────────────────────

export function codeToGraph(tree: Tree): { nodes: AppNode[]; edges: Edge[]; fileDependencies: FileDependency[] } {
  const nodes: AppNode[] = []
  const edges: Edge[] = []
  const fileDependencies: FileDependency[] = []

  // fnName → nodeId, used for edge inference
  const functionIds = new Map<string, string>()

  let y = Y_START

  for (const child of tree.rootNode.children) {
    // Skip tree-sitter ERROR/MISSING nodes
    if (child.type === 'ERROR' || child.type === 'MISSING') continue

    const t = child.type

    try {

    // ── import_statement (ESM) ────────────────────────────────────────────────
    if (t === 'import_statement') {
      const deps = extractImportDeps(child)
      fileDependencies.push(...deps)
      continue // imports don't generate canvas nodes in single-file mode
    }

    // ── function_declaration ──────────────────────────────────────────────────
    else if (t === 'function_declaration') {
      const name = child.childForFieldName('name')?.text
      if (!name) continue

      const params = extractParams(child.childForFieldName('parameters'))
      const id = `fn-${name}`
      functionIds.set(name, id)

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
      // Check for require() calls
      const requireDeps = extractRequireDeps(child)
      if (requireDeps.length > 0) {
        fileDependencies.push(...requireDeps)
      }

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
  try {
    for (const node of nodes) {
      if (node.type !== 'variableNode') continue
      const value = (node.data as { value: string }).value

      for (const [fnName, fnId] of functionIds) {
        if (value.includes(fnName)) {
          edges.push({
            id: `e-${fnId}-${node.id}`,
            source: fnId,
            target: node.id,
            targetHandle: 'target',
            type: 'default',
            animated: true,
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

  return { nodes: organicNodes, edges, fileDependencies }
}
