import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { ShieldAlert } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './TryCatchNode.css'

export interface TryCatchNodeData extends Record<string, unknown> {
  errorVar: string   // name of the catch parameter, e.g. "error"
}

export type TryCatchNodeType = Node<TryCatchNodeData, 'tryCatchNode'>

function TryCatchNode({ id, data, selected }: NodeProps<TryCatchNodeType>) {
  const { errorVar } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(errorVar)

  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft(errorVar)
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, errorVar, setEditingNodeId])

  function openEdit() {
    setDraft(errorVar)
    setEditing(true)
  }

  function save() {
    updateNodeData(id, { errorVar: draft.trim() || 'error' })
    setEditing(false)
  }

  function cancel() { setEditing(false) }
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  if (editing) {
    return (
      <div className="tc-node tc-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="tc-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Catch variable
            <input
              className="node-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. error"
              autoFocus
            />
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
      className={`tc-node${selected ? ' tc-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit catch variable"
    >
      {/* Input handle — top center */}
      <Handle type="target" position={Position.Top} className="tc-handle tc-handle--in" />

      <div className="tc-node__bar" />

      <div className="tc-node__header">
        <ShieldAlert size={12} className="tc-node__icon" />
        <span className="tc-node__label">try / catch</span>
      </div>

      <div className="tc-node__catch-var">
        catch (<span className="tc-node__var">{errorVar}</span>)
      </div>

      {/* Branch labels */}
      <div className="tc-node__branches">
        <span className="tc-node__branch tc-node__branch--success">success</span>
        <span className="tc-node__branch tc-node__branch--error">error</span>
      </div>

      {/* Success output handle — bottom left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="success"
        className="tc-handle tc-handle--success"
        style={{ left: '30%' }}
      />

      {/* Error output handle — bottom right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="error"
        className="tc-handle tc-handle--error"
        style={{ left: '70%' }}
      />
    </div>
  )
}

export default memo(TryCatchNode)
