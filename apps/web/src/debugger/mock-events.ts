import type { AppNode } from '../stores/canvas-store'
import type { ExecutionEvent } from './types'

/** Generate a mock sequence of execution events from the canvas nodes. */
export function generateMockEvents(nodes: AppNode[]): ExecutionEvent[] {
  const events: ExecutionEvent[] = []
  const codeNodes = nodes.filter((n) =>
    ['functionNode', 'variableNode', 'apiNode', 'conditionNode', 'loopNode', 'tryCatchNode'].includes(n.type ?? '')
  )

  if (codeNodes.length === 0) return []

  let time = Date.now() - codeNodes.length * 600

  for (const node of codeNodes) {
    const dur = Math.round(Math.random() * 80 + 20)
    const isError = Math.random() < 0.1  // 10% chance of error

    // Enter event
    events.push({
      id:        `${node.id}-enter-${time}`,
      nodeId:    node.id,
      eventType: 'enter',
      inputData: buildInputData(node),
      createdAt: new Date(time).toISOString(),
    })
    time += 50

    if (isError) {
      events.push({
        id:           `${node.id}-error-${time}`,
        nodeId:       node.id,
        eventType:    'error',
        durationMs:   dur,
        errorMessage: `TypeError: Cannot read property of undefined in ${nodeName(node)}`,
        createdAt:    new Date(time).toISOString(),
      })
    } else {
      events.push({
        id:          `${node.id}-exit-${time}`,
        nodeId:      node.id,
        eventType:   'exit',
        outputData:  buildOutputData(node),
        durationMs:  dur,
        createdAt:   new Date(time).toISOString(),
      })
    }
    time += dur + Math.round(Math.random() * 200 + 100)
  }

  return events
}

function nodeName(node: AppNode): string {
  const d = node.data as Record<string, unknown>
  const n = node as { id: string; type?: string }
  return (d.name as string) || n.type || n.id
}

function buildInputData(node: AppNode): Record<string, unknown> {
  const d = node.data as Record<string, unknown>
  if (node.type === 'functionNode') return { args: (d.params as string[]) ?? [] }
  if (node.type === 'variableNode') return { value: d.value }
  if (node.type === 'apiNode')      return { method: d.method, path: d.path }
  if (node.type === 'conditionNode') return { condition: d.condition }
  if (node.type === 'loopNode')     return { expression: d.expression }
  return {}
}

function buildOutputData(node: AppNode): Record<string, unknown> {
  if (node.type === 'functionNode') return { return: 'undefined' }
  if (node.type === 'variableNode') {
    const d = node.data as Record<string, unknown>
    return { value: d.value }
  }
  if (node.type === 'apiNode') return { status: 200, body: '{ "ok": true }' }
  if (node.type === 'conditionNode') return { branch: Math.random() > 0.5 ? 'true' : 'false' }
  if (node.type === 'loopNode') return { iterations: Math.floor(Math.random() * 10) + 1 }
  return {}
}
