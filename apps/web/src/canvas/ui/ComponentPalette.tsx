import { FunctionSquare, Variable, Globe, GitBranch, Repeat, ShieldAlert, MessageSquare, Database, Bug, ChevronLeft, ChevronRight } from 'lucide-react'
import './ComponentPalette.css'

export type PaletteNodeType = 'functionNode' | 'variableNode' | 'apiNode' | 'conditionNode' | 'loopNode' | 'tryCatchNode' | 'commentNode' | 'packageNode' | 'databaseTableNode' | 'bugNode'

const ITEMS: {
  type: PaletteNodeType
  label: string
  description: string
  icon: React.ReactNode
  colorClass: string
}[] = [
  {
    type: 'functionNode',
    label: 'Function',
    description: 'Named function block',
    icon: <FunctionSquare size={16} />,
    colorClass: 'palette-item--blue',
  },
  {
    type: 'variableNode',
    label: 'Variable',
    description: 'const / let declaration',
    icon: <Variable size={16} />,
    colorClass: 'palette-item--green',
  },
  {
    type: 'apiNode',
    label: 'API Call',
    description: 'HTTP fetch endpoint',
    icon: <Globe size={16} />,
    colorClass: 'palette-item--orange',
  },
  {
    type: 'conditionNode',
    label: 'Condition',
    description: 'if / else branch',
    icon: <GitBranch size={16} />,
    colorClass: 'palette-item--amber',
  },
  {
    type: 'loopNode',
    label: 'Loop',
    description: 'for / while / forEach',
    icon: <Repeat size={16} />,
    colorClass: 'palette-item--purple',
  },
  {
    type: 'tryCatchNode',
    label: 'Try-Catch',
    description: 'try / catch error block',
    icon: <ShieldAlert size={16} />,
    colorClass: 'palette-item--red',
  },
  {
    type: 'commentNode',
    label: 'Note',
    description: 'Canvas annotation',
    icon: <MessageSquare size={16} />,
    colorClass: 'palette-item--gray',
  },
  {
    type: 'databaseTableNode',
    label: 'DB Table',
    description: 'Database schema table',
    icon: <Database size={16} />,
    colorClass: 'palette-item--cyan',
  },
  {
    type: 'bugNode',
    label: 'Bug',
    description: 'Issue / bug tracker node',
    icon: <Bug size={16} />,
    colorClass: 'palette-item--red',
  },
]

interface Props {
  expanded: boolean
  onToggle: () => void
}

export default function ComponentPalette({ expanded, onToggle }: Props) {
  function onDragStart(e: React.DragEvent, type: PaletteNodeType) {
    e.dataTransfer.setData('application/devkarm-node-type', type)
    e.dataTransfer.effectAllowed = 'copy'

    // Custom drag ghost — a small dark pill matching the node accent
    const ghost = document.createElement('div')
    ghost.className = `palette-drag-ghost palette-drag-ghost--${type}`
    ghost.textContent = ITEMS.find((i) => i.type === type)?.label ?? type
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 60, 18)
    // Remove ghost after drag starts (next tick)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }

  return (
    <aside className={`sidebar${expanded ? ' sidebar--expanded' : ''}`}>
      {/* ── Collapse toggle ── */}
      <button className="sidebar-toggle" onClick={onToggle} title={expanded ? 'Collapse' : 'Expand'}>
        {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {expanded ? (
        /* ── Expanded: component palette ── */
        <div className="palette">
          <p className="palette-heading">Components</p>
          <p className="palette-sub">Drag onto canvas</p>

          <div className="palette-list">
            {ITEMS.map((item) => (
              <div
                key={item.type}
                className={`palette-item ${item.colorClass}`}
                draggable
                onDragStart={(e) => onDragStart(e, item.type)}
                title={`Drag to add ${item.label}`}
              >
                <span className="palette-item__icon">{item.icon}</span>
                <div className="palette-item__text">
                  <span className="palette-item__label">{item.label}</span>
                  <span className="palette-item__desc">{item.description}</span>
                </div>
                <span className="palette-item__drag-handle" aria-hidden>⠿</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Collapsed: icon strip ── */
        <div className="sidebar-icons">
          {ITEMS.map((item) => (
            <div
              key={item.type}
              className={`sidebar-icon-item ${item.colorClass}`}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              title={`Drag to add ${item.label}`}
            >
              {item.icon}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
