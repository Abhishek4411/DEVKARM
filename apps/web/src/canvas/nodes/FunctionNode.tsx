import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './FunctionNode.css'

export interface FunctionNodeData extends Record<string, unknown> {
  name: string
  params: string[]
  returnType: string
  code: string
}

export type FunctionNodeType = Node<FunctionNodeData, 'functionNode'>

function FunctionNode({ id, data, selected }: NodeProps<FunctionNodeType>) {
  const { name, params, returnType, code } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name, params: params.join(', '), returnType, code })

  // Allow external callers (context menu) to trigger edit mode via ui-store
  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft({ name, params: params.join(', '), returnType, code })
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, name, params, returnType, code, setEditingNodeId])

  function openEdit() {
    setDraft({ name, params: params.join(', '), returnType, code })
    setEditing(true)
  }

  function save() {
    updateNodeData(id, {
      name: draft.name.trim(),
      params: draft.params.split(',').map((p) => p.trim()).filter(Boolean),
      returnType: draft.returnType.trim(),
      code: draft.code,
    })
    setEditing(false)
  }

  function cancel() { setEditing(false) }

  // Stop React Flow from treating clicks inside the editor as canvas events
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  if (editing) {
    return (
      <div className="fn-node fn-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="fn-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Name
            <input className="node-edit-input" value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="node-edit-label">Params <span className="node-edit-hint">(comma separated)</span>
            <input className="node-edit-input" value={draft.params}
              onChange={(e) => setDraft((d) => ({ ...d, params: e.target.value }))} />
          </label>
          <label className="node-edit-label">Return type
            <input className="node-edit-input" value={draft.returnType}
              onChange={(e) => setDraft((d) => ({ ...d, returnType: e.target.value }))} />
          </label>
          <label className="node-edit-label">Body
            <textarea className="node-edit-textarea" value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
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
      className={`fn-node${selected ? ' fn-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit"
    >
      <Handle type="target" position={Position.Top} className="fn-handle" />
      <div className="fn-node__bar" />
      <div className="fn-node__header">
        <span className="fn-node__name">{name}</span>
        {returnType && <span className="fn-node__return">{returnType}</span>}
      </div>
      {params.length > 0 && (
        <div className="fn-node__params">
          {params.map((p, i) => (
            <span key={i} className="fn-node__param">{p}</span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="fn-handle" />
    </div>
  )
}

export default memo(FunctionNode)
