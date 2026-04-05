import { useState, useRef, useEffect } from 'react'
import { FileCode, FileText, Plus, X } from 'lucide-react'
import { useFileStore } from '../stores/file-store'
import './FileTabs.css'

interface Props {
  onSwitch: (id: string) => void
  onCreate: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  onCloseOthers: (id: string) => void
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'md' || ext === 'txt') return <FileText size={12} />
  return <FileCode size={12} />
}

type TabMenu = { id: string; x: number; y: number } | null

export default function FileTabs({ onSwitch, onCreate, onClose, onRename, onCloseOthers }: Props) {
  const files = useFileStore((s) => s.files)
  const activeFileId = useFileStore((s) => s.activeFileId)

  const [tabMenu, setTabMenu] = useState<TabMenu>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus rename input
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  // Close context menu on outside click
  useEffect(() => {
    if (!tabMenu) return
    function handler() { setTabMenu(null) }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [tabMenu])

  function startRename(id: string, currentName: string) {
    setTabMenu(null)
    setRenamingId(id)
    setRenameValue(currentName)
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== files.find((f) => f.id === id)?.name) {
      onRename(id, trimmed)
    }
    setRenamingId(null)
  }

  function onRenameKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') commitRename(id)
    if (e.key === 'Escape') setRenamingId(null)
  }

  function onTabContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setTabMenu({ id, x: e.clientX, y: e.clientY })
  }

  return (
    <div className="file-tabs">
      <div className="file-tabs__strip">
        {files.map((file) => {
          const isActive = file.id === activeFileId
          const isRenaming = renamingId === file.id

          return (
            <div
              key={file.id}
              className={`file-tab${isActive ? ' file-tab--active' : ''}`}
              onClick={() => !isRenaming && onSwitch(file.id)}
              onDoubleClick={() => startRename(file.id, file.name)}
              onContextMenu={(e) => onTabContextMenu(e, file.id)}
              title={file.name}
            >
              <span className="file-tab__icon">{fileIcon(file.name)}</span>

              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="file-tab__rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => onRenameKeyDown(e, file.id)}
                  onBlur={() => commitRename(file.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="file-tab__name">{file.name}</span>
              )}

              <button
                className="file-tab__close"
                onClick={(e) => { e.stopPropagation(); onClose(file.id) }}
                title="Close file"
                tabIndex={-1}
              >
                <X size={10} />
              </button>
            </div>
          )
        })}

        {/* New file button */}
        <button className="file-tabs__new" onClick={onCreate} title="New file">
          <Plus size={13} />
        </button>
      </div>

      {/* Tab right-click context menu */}
      {tabMenu && (
        <div
          className="file-tab-menu"
          style={{ left: tabMenu.x, top: tabMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="file-tab-menu__item"
            onClick={() => {
              const file = files.find((f) => f.id === tabMenu.id)
              if (file) startRename(tabMenu.id, file.name)
            }}
          >
            Rename
          </button>
          <button
            className="file-tab-menu__item"
            onClick={() => { onClose(tabMenu.id); setTabMenu(null) }}
          >
            Close
          </button>
          <div className="file-tab-menu__divider" />
          <button
            className="file-tab-menu__item"
            onClick={() => { onCloseOthers(tabMenu.id); setTabMenu(null) }}
          >
            Close Others
          </button>
        </div>
      )}
    </div>
  )
}
