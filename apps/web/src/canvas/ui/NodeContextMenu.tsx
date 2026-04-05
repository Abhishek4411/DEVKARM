import { useEffect, useRef } from 'react'
import { Code2, Copy, Edit2, FlaskConical, Trash2 } from 'lucide-react'
import './NodeContextMenu.css'

interface Props {
  x: number
  y: number
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onAddTest: () => void
  onViewCode: () => void
  onClose: () => void
}

export default function NodeContextMenu({
  x,
  y,
  onEdit,
  onDuplicate,
  onDelete,
  onAddTest,
  onViewCode,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Dismiss on click outside or ESC
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMousedown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('mousedown', handleMousedown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousedown', handleMousedown)
    }
  }, [onClose])

  // Clamp to viewport so menu never clips off screen
  const adjustedX = Math.min(x, window.innerWidth - 164)
  const adjustedY = Math.min(y, window.innerHeight - 196)

  return (
    <div
      className="node-ctx-menu"
      style={{ left: adjustedX, top: adjustedY }}
      ref={menuRef}
      // Prevent React Flow from treating this as a canvas click
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button className="node-ctx-item" onClick={onEdit}>
        <Edit2 size={13} className="node-ctx-icon" />
        Edit
      </button>
      <button className="node-ctx-item" onClick={onDuplicate}>
        <Copy size={13} className="node-ctx-icon" />
        Duplicate
      </button>

      <div className="node-ctx-divider" />

      <button className="node-ctx-item" onClick={onViewCode}>
        <Code2 size={13} className="node-ctx-icon" />
        View Code
      </button>
      <button className="node-ctx-item" onClick={onAddTest}>
        <FlaskConical size={13} className="node-ctx-icon" />
        Add Test
      </button>

      <div className="node-ctx-divider" />

      <button className="node-ctx-item node-ctx-item--danger" onClick={onDelete}>
        <Trash2 size={13} className="node-ctx-icon" />
        Delete
      </button>
    </div>
  )
}
