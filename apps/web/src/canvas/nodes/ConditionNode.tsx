import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './ConditionNode.css'

export interface ConditionNodeData extends Record<string, unknown> {
  condition: string
}

export type ConditionNodeType = Node<ConditionNodeData, 'conditionNode'>

function ConditionNode({ id, data, selected }: NodeProps<ConditionNodeType>) {
  const { condition } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(condition)

  // Allow external callers (context menu) to trigger edit mode via ui-store
  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft(condition)
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, condition, setEditingNodeId])

  function openEdit() {
    setDraft(condition)
    setEditing(true)
  }

  function save() {
    updateNodeData(id, { condition: draft.trim() })
    setEditing(false)
  }

  function cancel() { setEditing(false) }
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  if (editing) {
    return (
      <div className="cond-node cond-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="cond-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Condition
            <input
              className="node-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. x > 10"
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
      className={`cond-node${selected ? ' cond-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit condition"
    >
      {/* Input handle — top center */}
      <Handle type="target" position={Position.Top} className="cond-handle cond-handle--in" />

      <div className="cond-node__bar" />

      <div className="cond-node__header">
        <span className="cond-node__keyword">if</span>
      </div>

      <div className="cond-node__condition">
        {condition
          ? <span className="cond-node__expr">( {condition} )</span>
          : <span className="cond-node__placeholder">( condition )</span>
        }
      </div>

      {/* Branch labels row */}
      <div className="cond-node__branches">
        <span className="cond-node__branch cond-node__branch--true">true</span>
        <span className="cond-node__branch cond-node__branch--false">false</span>
      </div>

      {/* True output handle — bottom left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="cond-handle cond-handle--true"
        style={{ left: '30%' }}
      />

      {/* False output handle — bottom right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="cond-handle cond-handle--false"
        style={{ left: '70%' }}
      />
    </div>
  )
}

export default memo(ConditionNode)
