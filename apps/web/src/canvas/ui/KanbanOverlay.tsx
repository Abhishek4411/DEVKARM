import { useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvas-store'
import type { BugNodeData, BugStatus } from '../nodes/BugNode'
import './KanbanOverlay.css'

// ── Column config ─────────────────────────────────────────────────────────────

type Column = { id: BugStatus; label: string; color: string }

const COLUMNS: Column[] = [
  { id: 'open',        label: 'Open',        color: '#EF4444' },
  { id: 'in-progress', label: 'In Progress', color: '#F59E0B' },
  { id: 'review',      label: 'Review',      color: '#3B82F6' },
  { id: 'done',        label: 'Done',        color: '#10B981' },
]

const PRIORITY_COLOR: Record<string, string> = {
  low:      '#10B981',
  medium:   '#F59E0B',
  high:     '#F97316',
  critical: '#EF4444',
}

// ── Sortable card ─────────────────────────────────────────────────────────────

interface CardProps {
  nodeId:  string
  data:    BugNodeData
  onPan:  (nodeId: string) => void
}

function KanbanCard({ nodeId, data, onPan }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nodeId,
  })

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.45 : 1,
    cursor:     isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-card"
      {...attributes}
      {...listeners}
    >
      <div className="kanban-card__top">
        <span className="kanban-card__id">{data.bugId}</span>
        <span
          className="kanban-card__priority"
          style={{ color: PRIORITY_COLOR[data.priority] ?? '#94a3b8' }}
        >
          {data.priority}
        </span>
      </div>
      <p className="kanban-card__title">{data.title}</p>
      {data.assignee && <p className="kanban-card__assignee">{data.assignee}</p>}
      <button
        className="kanban-card__pan-btn"
        title="Pan canvas to this node"
        onClick={(e) => { e.stopPropagation(); onPan(nodeId) }}
        onPointerDown={(e) => e.stopPropagation()} // prevent drag conflict
      >
        ↗
      </button>
    </div>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────

interface Props {
  onClose:    () => void
  onPanToNode: (nodeId: string) => void
}

export default function KanbanOverlay({ onClose, onPanToNode }: Props) {
  const nodes          = useCanvasStore((s) => s.nodes)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const bugNodes = nodes.filter((n) => n.type === 'bugNode') as Array<{
    id: string; data: BugNodeData
  }>

  function getColumnCards(status: BugStatus) {
    return bugNodes.filter((n) => n.data.status === status)
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      // `over.id` is either another card id or a column droppable id
      const targetId = String(over.id)

      // Check if dropped directly on a column header/droppable
      const targetColumn = COLUMNS.find((c) => c.id === targetId)
      if (targetColumn) {
        updateNodeData(String(active.id), { status: targetColumn.id })
        return
      }

      // Dropped on another card — find that card's column
      const targetNode = bugNodes.find((n) => n.id === targetId)
      if (targetNode && targetNode.data.status !== undefined) {
        updateNodeData(String(active.id), { status: targetNode.data.status })
      }
    },
    [bugNodes, updateNodeData],
  )

  return (
    <div className="kanban-overlay">
      {/* Header */}
      <div className="kanban-header">
        <span className="kanban-title">Kanban Board</span>
        <span className="kanban-hint">Ctrl+B to close</span>
        <button className="kanban-close" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map((col) => {
            const cards = getColumnCards(col.id)
            return (
              <div key={col.id} className="kanban-column">
                {/* Column header */}
                <div className="kanban-col-header" style={{ borderTopColor: col.color }}>
                  <span className="kanban-col-label" style={{ color: col.color }}>{col.label}</span>
                  <span className="kanban-col-count">{cards.length}</span>
                </div>

                {/* Drop zone + sortable cards */}
                <SortableContext
                  items={cards.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="kanban-col-body">
                    {cards.length === 0 && (
                      <div className="kanban-col-empty">Drop here</div>
                    )}
                    {cards.map((node) => (
                      <KanbanCard
                        key={node.id}
                        nodeId={node.id}
                        data={node.data}
                        onPan={onPanToNode}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            )
          })}
        </div>
      </DndContext>

      {bugNodes.length === 0 && (
        <p className="kanban-no-bugs">Add Bug nodes to the canvas to see them here.</p>
      )}
    </div>
  )
}
