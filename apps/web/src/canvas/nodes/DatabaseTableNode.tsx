import { memo, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Database, Plus, Trash2, Key } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvas-store'
import { useUiStore } from '../../stores/ui-store'
import './DatabaseTableNode.css'

export type ColumnConstraint = 'PK' | 'FK' | 'NOT NULL' | 'UNIQUE' | 'DEFAULT'

export interface TableColumn {
  id: string
  name: string
  type: string
  constraints: ColumnConstraint[]
}

export interface DatabaseTableNodeData extends Record<string, unknown> {
  tableName: string
  columns: TableColumn[]
}

export type DatabaseTableNodeType = Node<DatabaseTableNodeData, 'databaseTableNode'>

const SQL_TYPES = ['INTEGER', 'BIGINT', 'TEXT', 'VARCHAR(255)', 'BOOLEAN', 'TIMESTAMP', 'UUID', 'JSONB', 'REAL', 'NUMERIC', 'DATE']

function makeColumn(): TableColumn {
  return { id: `col-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: '', type: 'TEXT', constraints: [] }
}

function ConstraintBadge({ label }: { label: ColumnConstraint }) {
  return <span className={`db-badge db-badge--${label.toLowerCase().replace(' ', '-')}`}>{label}</span>
}

function DatabaseTableNode({ id, data, selected }: NodeProps<DatabaseTableNodeType>) {
  const { tableName, columns } = data
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)

  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(tableName)
  const [draftColumns, setDraftColumns] = useState<TableColumn[]>(columns)

  // Context menu edit trigger
  const editingNodeId = useUiStore((s) => s.editingNodeId)
  const setEditingNodeId = useUiStore((s) => s.setEditingNodeId)
  useEffect(() => {
    if (editingNodeId === id) {
      openEdit()
      setEditingNodeId(null)
    }
  }, [editingNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit() {
    setDraftName(tableName)
    setDraftColumns(columns.length > 0 ? columns : [makeColumn()])
    setEditing(true)
  }

  function save() {
    const cleaned = draftColumns.filter((c) => c.name.trim())
    updateNodeData(id, { tableName: draftName.trim() || 'table', columns: cleaned })
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  function addColumn() {
    setDraftColumns((prev) => [...prev, makeColumn()])
  }

  function removeColumn(colId: string) {
    setDraftColumns((prev) => prev.filter((c) => c.id !== colId))
  }

  function updateColumn(colId: string, patch: Partial<TableColumn>) {
    setDraftColumns((prev) => prev.map((c) => c.id === colId ? { ...c, ...patch } : c))
  }

  function toggleConstraint(colId: string, constraint: ColumnConstraint) {
    setDraftColumns((prev) =>
      prev.map((c) => {
        if (c.id !== colId) return c
        const has = c.constraints.includes(constraint)
        return {
          ...c,
          constraints: has
            ? c.constraints.filter((x) => x !== constraint)
            : [...c.constraints, constraint],
        }
      })
    )
  }

  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div
        className={`db-node db-node--editing${selected ? ' db-node--selected' : ''}`}
        onMouseDown={stopProp}
        onClick={stopProp}
        onDoubleClick={stopProp}
      >
        {/* Header */}
        <div className="db-node__header">
          <Database size={13} className="db-node__icon" />
          <input
            className="db-node__name-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="table_name"
            autoFocus
          />
        </div>

        {/* Column editor */}
        <div className="db-node__col-editor">
          {draftColumns.map((col) => (
            <div key={col.id} className="db-col-row">
              <input
                className="db-col-row__name"
                placeholder="column_name"
                value={col.name}
                onChange={(e) => updateColumn(col.id, { name: e.target.value })}
              />
              <select
                className="db-col-row__type"
                value={col.type}
                onChange={(e) => updateColumn(col.id, { type: e.target.value })}
              >
                {SQL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="db-col-row__constraints">
                {(['PK', 'FK', 'NOT NULL', 'UNIQUE'] as ColumnConstraint[]).map((c) => (
                  <button
                    key={c}
                    className={`db-constraint-btn${col.constraints.includes(c) ? ' db-constraint-btn--active' : ''}`}
                    onClick={() => toggleConstraint(col.id, c)}
                    title={c}
                  >
                    {c === 'PK' ? 'PK' : c === 'FK' ? 'FK' : c === 'NOT NULL' ? 'NN' : 'UQ'}
                  </button>
                ))}
              </div>
              <button className="db-col-row__del" onClick={() => removeColumn(col.id)} title="Remove column">
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button className="db-node__add-col" onClick={addColumn}>
            <Plus size={12} /> Add Column
          </button>
        </div>

        {/* Actions */}
        <div className="db-node__actions">
          <button className="db-node__btn db-node__btn--save" onClick={save}>Save</button>
          <button className="db-node__btn db-node__btn--cancel" onClick={cancel}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`db-node${selected ? ' db-node--selected' : ''}`}
      onDoubleClick={openEdit}
      title="Double-click to edit schema"
    >
      {/* FK target handles (left side) */}
      <Handle type="target" position={Position.Left} id="fk-target" className="db-node__handle" />

      {/* Header */}
      <div className="db-node__header">
        <Database size={13} className="db-node__icon" />
        <span className="db-node__name">{tableName || 'untitled_table'}</span>
      </div>

      {/* Columns */}
      <div className="db-node__columns">
        {columns.length === 0 ? (
          <div className="db-node__empty">Double-click to add columns</div>
        ) : (
          columns.map((col) => (
            <div key={col.id} className="db-node__col-row">
              <div className="db-node__col-left">
                {col.constraints.includes('PK') && <Key size={10} className="db-node__pk-icon" />}
                <span className="db-node__col-name">{col.name || '—'}</span>
              </div>
              <div className="db-node__col-right">
                <span className="db-node__col-type">{col.type}</span>
                {col.constraints.filter((c) => c !== 'PK').map((c) => (
                  <ConstraintBadge key={c} label={c} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add column hint */}
      <div className="db-node__footer">
        <Plus size={10} /> <span>Double-click to edit</span>
      </div>

      {/* FK source handles (right side) */}
      <Handle type="source" position={Position.Right} id="fk-source" className="db-node__handle" />
    </div>
  )
}

export default memo(DatabaseTableNode)
