import { memo, useState } from 'react'
import { Handle, Position, type Node } from '@xyflow/react'
import { useCanvasStore } from '../../stores/canvas-store'
import './BugNode.css'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BugPriority = 'low' | 'medium' | 'high' | 'critical'
export type BugStatus   = 'open' | 'in-progress' | 'review' | 'done'

export interface BugNodeData extends Record<string, unknown> {
  bugId:       string
  title:       string
  priority:    BugPriority
  assignee:    string
  status:      BugStatus
  description: string
}

export type BugNodeType = Node<BugNodeData, 'bugNode'>

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<BugPriority, string> = {
  low:      '#10B981',
  medium:   '#F59E0B',
  high:     '#F97316',
  critical: '#EF4444',
}

const STATUS_COLOR: Record<BugStatus, string> = {
  'open':        '#EF4444',
  'in-progress': '#F59E0B',
  'review':      '#3B82F6',
  'done':        '#10B981',
}

const STATUS_LABEL: Record<BugStatus, string> = {
  'open':        'Open',
  'in-progress': 'In Progress',
  'review':      'Review',
  'done':        'Done',
}

const PRIORITIES: BugPriority[] = ['low', 'medium', 'high', 'critical']
const STATUSES: BugStatus[]     = ['open', 'in-progress', 'review', 'done']

// ── Component ─────────────────────────────────────────────────────────────────

function BugNode({ id, data }: { id: string; data: BugNodeData }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<BugNodeData>(data)
  const updateNodeData        = useCanvasStore((s) => s.updateNodeData)

  const accentColor = PRIORITY_COLOR[data.priority]
  const statusColor = STATUS_COLOR[data.status]

  function openEdit() {
    setDraft({ ...data })
    setEditing(true)
  }

  function save() {
    updateNodeData(id, draft)
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="bug-node bug-node--editing" style={{ '--bug-accent': accentColor } as React.CSSProperties}>
        <Handle type="target" position={Position.Top}    className="bug-handle" />
        <Handle type="source" position={Position.Bottom} className="bug-handle" />

        <div className="bug-node__accent" style={{ background: accentColor }} />

        <div className="bug-node__edit-body">
          <label className="bug-edit-label">Bug ID</label>
          <input
            className="bug-edit-input"
            value={draft.bugId}
            onChange={(e) => setDraft({ ...draft, bugId: e.target.value })}
          />

          <label className="bug-edit-label">Title</label>
          <input
            className="bug-edit-input"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />

          <label className="bug-edit-label">Description</label>
          <textarea
            className="bug-edit-textarea"
            rows={3}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />

          <label className="bug-edit-label">Assignee</label>
          <input
            className="bug-edit-input"
            value={draft.assignee}
            placeholder="Unassigned"
            onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
          />

          <label className="bug-edit-label">Priority</label>
          <select
            className="bug-edit-select"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.value as BugPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <label className="bug-edit-label">Status</label>
          <select
            className="bug-edit-select"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as BugStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>

          <div className="bug-edit-actions">
            <button className="bug-edit-btn bug-edit-btn--save"   onClick={save}>Save</button>
            <button className="bug-edit-btn bug-edit-btn--cancel" onClick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  const initials = data.assignee
    ? data.assignee.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div
      className="bug-node"
      style={{ '--bug-accent': accentColor } as React.CSSProperties}
      onDoubleClick={openEdit}
    >
      <Handle type="target" position={Position.Top}    className="bug-handle" />
      <Handle type="source" position={Position.Bottom} className="bug-handle" />

      {/* Priority accent bar */}
      <div className="bug-node__accent" style={{ background: accentColor }} />

      {/* Header row: bug-id + status dot */}
      <div className="bug-node__header">
        <span className="bug-node__id">{data.bugId}</span>
        <span className="bug-node__status-dot" style={{ background: statusColor }} title={STATUS_LABEL[data.status]} />
      </div>

      {/* Title */}
      <p className="bug-node__title">{data.title || 'Untitled bug'}</p>

      {/* Footer: priority badge + assignee avatar */}
      <div className="bug-node__footer">
        <span
          className="bug-node__priority"
          style={{ color: accentColor, borderColor: accentColor + '44', background: accentColor + '18' }}
        >
          {data.priority}
        </span>
        <span
          className="bug-node__assignee"
          title={data.assignee || 'Unassigned'}
          style={{ borderColor: statusColor + '80', color: statusColor }}
        >
          {initials}
        </span>
      </div>

      <p className="bug-node__hint">Double-click to edit</p>
    </div>
  )
}

export default memo(BugNode)
