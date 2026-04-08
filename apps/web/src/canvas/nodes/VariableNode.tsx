import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './VariableNode.css'

export interface VariableNodeData extends Record<string, unknown> {
  name: string
  varType: string
  value: string
}

export type VariableNodeType = Node<VariableNodeData, 'variableNode'>

function VariableNode({ id, data, selected }: NodeProps<VariableNodeType>) {
  const { name, varType, value } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name, varType, value })

  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft({ name, varType, value })
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, name, varType, value, setEditingNodeId])

  function openEdit() {
    setDraft({ name, varType, value })
    setEditing(true)
  }

  function save() {
    updateNodeData(id, {
      name: draft.name.trim(),
      varType: draft.varType.trim(),
      value: draft.value.trim(),
    })
    setEditing(false)
  }

  function cancel() { setEditing(false) }
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  if (editing) {
    return (
      <div className="var-node var-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="var-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Name
            <input className="node-edit-input" value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="node-edit-label">Kind
            <select className="node-edit-input" value={draft.varType}
              onChange={(e) => setDraft((d) => ({ ...d, varType: e.target.value }))}>
              <option value="const">const</option>
              <option value="let">let</option>
              <option value="var">var</option>
            </select>
          </label>
          <label className="node-edit-label">Value
            <input className="node-edit-input" value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} />
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
      className={`var-node${selected ? ' var-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit"
    >
      <Handle type="target" position={Position.Top} id="target" className="var-handle" />
      <div className="var-node__bar" />
      <div className="var-node__header">
        <span className="var-node__name">{name}</span>
        <span className="var-node__type">{varType}</span>
      </div>
      <div className="var-node__value">{value}</div>
      <Handle type="source" position={Position.Bottom} className="var-handle" />
    </div>
  )
}

export default memo(VariableNode)
