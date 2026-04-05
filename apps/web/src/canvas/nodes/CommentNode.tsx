import { memo, useState, useRef, useEffect } from 'react'
import { type NodeProps, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './CommentNode.css'

export interface CommentNodeData extends Record<string, unknown> {
  text: string
  width: number
}

export type CommentNodeType = Node<CommentNodeData, 'commentNode'>

function CommentNode({ id, data, selected }: NodeProps<CommentNodeType>) {
  const { text, width } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Context menu edit trigger
  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      setDraft(text)
      setEditing(true)
      setEditingNodeId(null)
    }
  }, [editingNodeId, id, text, setEditingNodeId])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        textareaRef.current?.select()
      })
    }
  }, [editing])

  function openEdit() {
    setDraft(text)
    setEditing(true)
  }

  function save() {
    updateNodeData(id, { text: draft })
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { cancel(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { save(); return }
  }

  // ── Width resize drag ──────────────────────────────────────────────────────
  function onResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startW = width ?? 200

    function onMove(me: MouseEvent) {
      const newW = Math.min(400, Math.max(120, startW + (me.clientX - startX)))
      updateNodeData(id, { width: Math.round(newW) })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  const nodeWidth = width ?? 200

  if (editing) {
    return (
      <div
        className={`comment-node comment-node--editing${selected ? ' comment-node--selected' : ''}`}
        style={{ width: nodeWidth }}
        onMouseDown={stopProp}
        onClick={stopProp}
      >
        <textarea
          ref={textareaRef}
          className="comment-node__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a note..."
          rows={4}
        />
        <div className="comment-node__edit-actions">
          <button className="comment-node__btn comment-node__btn--save" onClick={save}>
            Save
          </button>
          <button className="comment-node__btn comment-node__btn--cancel" onClick={cancel}>
            Cancel
          </button>
          <span className="comment-node__hint">Ctrl+Enter to save · Esc to cancel</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`comment-node${selected ? ' comment-node--selected' : ''}`}
      style={{ width: nodeWidth }}
      onDoubleClick={openEdit}
      title="Double-click to edit note"
    >
      <div className="comment-node__label">NOTE</div>
      <div className="comment-node__body">
        {text
          ? text.split('\n').map((line, i) => (
              <span key={i} className="comment-node__line">{line || <br />}</span>
            ))
          : <span className="comment-node__empty">Double-click to add a note…</span>
        }
      </div>
      {/* Resize handle — bottom-right corner only */}
      <div
        className="comment-node__resize-handle"
        onMouseDown={onResizeMouseDown}
        title="Drag to resize"
      />
    </div>
  )
}

export default memo(CommentNode)
