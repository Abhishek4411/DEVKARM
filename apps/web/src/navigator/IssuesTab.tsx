import { useState } from 'react'
import { Plus, Bug } from 'lucide-react'
import { useCanvasStore } from '../stores/canvas-store'
import type { BugNodeData, BugPriority, BugStatus } from '../canvas/nodes/BugNode'
import './IssuesTab.css'

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

let bugCounter = 1

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Called with the canvas node id when user clicks "Go to" */
  onPanToNode: (nodeId: string) => void
}

export default function IssuesTab({ onPanToNode }: Props) {
  const nodes        = useCanvasStore((s) => s.nodes)
  const addNode      = useCanvasStore((s) => s.addNode)
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [filterStatus,   setFilterStatus]   = useState<BugStatus | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<BugPriority | 'all'>('all')
  const [showForm,       setShowForm]       = useState(false)

  // New issue form state
  const [newTitle,       setNewTitle]       = useState('')
  const [newPriority,    setNewPriority]    = useState<BugPriority>('medium')
  const [newAssignee,    setNewAssignee]    = useState('')
  const [newDescription, setNewDescription] = useState('')

  // Gather all bug nodes from canvas
  const bugNodes = nodes.filter((n) => n.type === 'bugNode') as Array<{ id: string; data: BugNodeData; position: { x: number; y: number } }>

  // Apply filters
  const visible = bugNodes.filter((n) => {
    if (filterStatus   !== 'all' && n.data.status   !== filterStatus)   return false
    if (filterPriority !== 'all' && n.data.priority !== filterPriority) return false
    return true
  })

  // Counts for badge
  const openCount = bugNodes.filter((n) => n.data.status !== 'done').length

  function handleAddIssue() {
    if (!newTitle.trim()) return

    const existingIds = bugNodes.map((n) => {
      const match = n.data.bugId.match(/BUG-(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : bugCounter++
    const bugId   = `BUG-${nextNum}`

    // Place new bug to the right of the last node, or a default position
    const maxX = nodes.reduce((m, nd) => Math.max(m, nd.position.x), 200)
    const maxY = nodes.reduce((m, nd) => Math.max(m, nd.position.y), 100)

    addNode({
      id:       `bug-${Date.now()}`,
      type:     'bugNode',
      position: { x: maxX + 200, y: maxY },
      data: {
        bugId,
        title:       newTitle.trim(),
        priority:    newPriority,
        assignee:    newAssignee.trim(),
        status:      'open',
        description: newDescription.trim(),
      },
    })

    setNewTitle('')
    setNewPriority('medium')
    setNewAssignee('')
    setNewDescription('')
    setShowForm(false)
  }

  return (
    <div className="issues-tab">
      {/* Header */}
      <div className="issues-tab__header">
        <div className="issues-tab__title-row">
          <Bug size={13} />
          <span>Issues</span>
          {openCount > 0 && <span className="issues-badge">{openCount}</span>}
        </div>
        <button className="issues-add-btn" onClick={() => setShowForm((v) => !v)} title="New Issue">
          <Plus size={13} />
        </button>
      </div>

      {/* New issue form */}
      {showForm && (
        <div className="issues-form">
          <input
            className="issues-input"
            placeholder="Issue title *"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddIssue()}
            autoFocus
          />
          <textarea
            className="issues-textarea"
            placeholder="Description (optional)"
            rows={2}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <input
            className="issues-input"
            placeholder="Assignee"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
          />
          <select
            className="issues-select"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as BugPriority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div className="issues-form-actions">
            <button className="issues-btn issues-btn--primary" onClick={handleAddIssue}>Add</button>
            <button className="issues-btn issues-btn--ghost"   onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="issues-filters">
        <select
          className="issues-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as BugStatus | 'all')}
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select
          className="issues-filter-select"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as BugPriority | 'all')}
        >
          <option value="all">All priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Issue list */}
      <div className="issues-list">
        {visible.length === 0 && (
          <p className="issues-empty">
            {bugNodes.length === 0 ? 'No issues yet. Add a Bug node.' : 'No issues match the filter.'}
          </p>
        )}
        {visible.map((n) => (
          <div
            key={n.id}
            className="issue-card"
            style={{ borderLeftColor: PRIORITY_COLOR[n.data.priority] }}
          >
            <div className="issue-card__top">
              <span className="issue-card__id">{n.data.bugId}</span>
              <span
                className="issue-card__status"
                style={{ color: STATUS_COLOR[n.data.status], background: STATUS_COLOR[n.data.status] + '18' }}
              >
                {STATUS_LABEL[n.data.status]}
              </span>
            </div>
            <p className="issue-card__title">{n.data.title}</p>
            {n.data.description && (
              <p className="issue-card__desc">{n.data.description}</p>
            )}
            <div className="issue-card__footer">
              <span
                className="issue-card__priority"
                style={{ color: PRIORITY_COLOR[n.data.priority] }}
              >
                {n.data.priority}
              </span>
              {n.data.assignee && (
                <span className="issue-card__assignee">{n.data.assignee}</span>
              )}
              <div className="issue-card__actions">
                {/* Quick status cycle */}
                {n.data.status !== 'done' && (
                  <button
                    className="issue-action-btn"
                    title="Mark Done"
                    onClick={() => updateNodeData(n.id, { status: 'done' })}
                  >
                    ✓
                  </button>
                )}
                <button
                  className="issue-action-btn"
                  title="Pan to node"
                  onClick={() => onPanToNode(n.id)}
                >
                  ↗
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
