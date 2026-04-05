import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './ApiNode.css'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ApiStatus = 'idle' | 'ok' | 'error' | 'loading'

export interface ApiNodeData extends Record<string, unknown> {
  method: HttpMethod
  path: string
  status: ApiStatus
}

export type ApiNodeType = Node<ApiNodeData, 'apiNode'>

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    '#10B981',
  POST:   '#3B82F6',
  PUT:    '#F97316',
  PATCH:  '#a78bfa',
  DELETE: '#EF4444',
}

const STATUS_COLORS: Record<ApiStatus, string> = {
  idle:    '#4b5563',
  ok:      '#10B981',
  error:   '#EF4444',
  loading: '#F97316',
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function ApiNode({ id, data, selected }: NodeProps<ApiNodeType>) {
  const { method, path, status } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ method, path })

  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft({ method, path })
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, method, path, setEditingNodeId])

  function openEdit() {
    setDraft({ method, path })
    setEditing(true)
  }

  function save() {
    updateNodeData(id, {
      method: draft.method,
      path: draft.path.trim(),
    })
    setEditing(false)
  }

  function cancel() { setEditing(false) }
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  const methodColor = METHOD_COLORS[method] ?? '#6b7280'
  const statusColor = STATUS_COLORS[status] ?? '#4b5563'

  if (editing) {
    return (
      <div className="api-node api-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="api-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Method
            <select className="node-edit-input" value={draft.method}
              onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as HttpMethod }))}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="node-edit-label">URL / Path
            <input className="node-edit-input" value={draft.path}
              onChange={(e) => setDraft((d) => ({ ...d, path: e.target.value }))} />
          </label>
          <div className="node-edit-actions">
            <button className="node-edit-btn node-edit-btn--save" onClick={save}>Save</button>
            <button className="node-edit-btn node-edit-btn--cancel" onClick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`api-node${selected ? ' api-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit"
    >
      <Handle type="target" position={Position.Top} className="api-handle" />
      <div className="api-node__bar" />
      <div className="api-node__header">
        <span className="api-node__method"
          style={{ color: methodColor, borderColor: methodColor + '55', background: methodColor + '18' }}>
          {method}
        </span>
        <span className="api-node__status-dot" style={{ background: statusColor }} title={status} />
      </div>
      <div className="api-node__path">{path}</div>
      <Handle type="source" position={Position.Bottom} className="api-handle" />
    </div>
  )
}

export default memo(ApiNode)
