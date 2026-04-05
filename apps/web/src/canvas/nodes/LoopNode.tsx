import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Repeat } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './LoopNode.css'

export type LoopKind = 'for' | 'while' | 'forEach'

export interface LoopNodeData extends Record<string, unknown> {
  loopKind: LoopKind
  expression: string
}

export type LoopNodeType = Node<LoopNodeData, 'loopNode'>

const KIND_LABELS: Record<LoopKind, string> = {
  for:     'for',
  while:   'while',
  forEach: 'forEach',
}

function LoopNode({ id, data, selected }: NodeProps<LoopNodeType>) {
  const { loopKind, expression } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ loopKind, expression })

  // Allow external callers (context menu) to trigger edit mode via ui-store
  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft({ loopKind, expression })
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, loopKind, expression, setEditingNodeId])

  function openEdit() {
    setDraft({ loopKind, expression })
    setEditing(true)
  }

  function save() {
    updateNodeData(id, { loopKind: draft.loopKind, expression: draft.expression.trim() })
    setEditing(false)
  }

  function cancel() { setEditing(false) }
  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  if (editing) {
    return (
      <div className="loop-node loop-node--editing" onMouseDown={stopProp} onClick={stopProp}>
        <div className="loop-node__bar" />
        <div className="node-edit-form" onDoubleClick={stopProp}>
          <label className="node-edit-label">Loop type
            <select
              className="node-edit-input"
              value={draft.loopKind}
              onChange={(e) => setDraft((d) => ({ ...d, loopKind: e.target.value as LoopKind }))}
            >
              <option value="for">for</option>
              <option value="while">while</option>
              <option value="forEach">forEach</option>
            </select>
          </label>
          <label className="node-edit-label">Expression
            <input
              className="node-edit-input"
              value={draft.expression}
              onChange={(e) => setDraft((d) => ({ ...d, expression: e.target.value }))}
              placeholder="e.g. let i = 0; i < 10; i++"
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
      className={`loop-node${selected ? ' loop-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit loop"
    >
      <Handle type="target" position={Position.Top} className="loop-handle" />

      <div className="loop-node__bar" />

      <div className="loop-node__header">
        <span className="loop-node__keyword">{KIND_LABELS[loopKind]}</span>
        <Repeat size={12} className="loop-node__icon" />
      </div>

      <div className="loop-node__expression">
        {expression
          ? <span className="loop-node__expr">( {expression} )</span>
          : <span className="loop-node__placeholder">( expression )</span>
        }
      </div>

      <Handle type="source" position={Position.Bottom} className="loop-handle" />
    </div>
  )
}

export default memo(LoopNode)
