import React, { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { useFileStore } from '../../stores/file-store'
import { useCanvasStore } from '../../stores/canvas-store'
import './FileRegionNode.css'

// ── Color mapping by file extension ──────────────────────────────────────────
const EXT_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  '.ts':   { border: 'rgba(59,130,246,0.4)',  bg: 'rgba(59,130,246,0.04)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.12)' },
  '.tsx':  { border: 'rgba(59,130,246,0.4)',  bg: 'rgba(59,130,246,0.04)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.12)' },
  '.js':   { border: 'rgba(234,179,8,0.4)',   bg: 'rgba(234,179,8,0.04)',   text: '#facc15', glow: 'rgba(234,179,8,0.12)' },
  '.jsx':  { border: 'rgba(234,179,8,0.4)',   bg: 'rgba(234,179,8,0.04)',   text: '#facc15', glow: 'rgba(234,179,8,0.12)' },
  '.py':   { border: 'rgba(16,185,129,0.4)',  bg: 'rgba(16,185,129,0.04)',  text: '#34d399', glow: 'rgba(16,185,129,0.12)' },
  '.go':   { border: 'rgba(6,182,212,0.4)',   bg: 'rgba(6,182,212,0.04)',   text: '#22d3ee', glow: 'rgba(6,182,212,0.12)' },
  '.rs':   { border: 'rgba(249,115,22,0.4)',  bg: 'rgba(249,115,22,0.04)',  text: '#fb923c', glow: 'rgba(249,115,22,0.12)' },
  '.css':  { border: 'rgba(168,85,247,0.4)',  bg: 'rgba(168,85,247,0.04)',  text: '#c084fc', glow: 'rgba(168,85,247,0.12)' },
  '.json': { border: 'rgba(100,116,139,0.4)', bg: 'rgba(100,116,139,0.04)', text: '#94a3b8', glow: 'rgba(100,116,139,0.12)' },
}

const DEFAULT_COLOR = { border: 'rgba(167,139,250,0.3)', bg: 'rgba(167,139,250,0.04)', text: '#c4b5fd', glow: 'rgba(167,139,250,0.12)' }

function getExtColor(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.'))
  return EXT_COLORS[ext] ?? DEFAULT_COLOR
}

function getFileIcon(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.'))
  switch (ext) {
    case '.ts': case '.tsx': return '🔷'
    case '.js': case '.jsx': return '🟡'
    case '.py': return '🐍'
    case '.go': return '🔵'
    case '.rs': return '🦀'
    case '.css': return '🎨'
    case '.json': return '📋'
    default: return '📄'
  }
}

// ── Node Data Interface ──────────────────────────────────────────────────────
export interface FileRegionNodeData extends Record<string, unknown> {
  fileName: string
  fileId: string
  nodeCount: number
  isUnresolved?: boolean
  dependencies?: { importedSymbol: string; fromPath: string }[]
}

export type FileRegionNodeType = Node<FileRegionNodeData, 'fileRegionNode'>

// ── Component ────────────────────────────────────────────────────────────────
function FileRegionNode({ data }: NodeProps<FileRegionNodeType>) {
  const { fileName, fileId, nodeCount, isUnresolved, dependencies } = data
  const color = getExtColor(fileName)
  const icon = getFileIcon(fileName)

  const switchFile = useFileStore((s) => s.switchFile)
  const setProjectGraphMode = useCanvasStore((s) => s.setProjectGraphMode)

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isUnresolved) return
    // Exit Project Graph Mode and switch to this file
    setProjectGraphMode(false)
    switchFile(fileId)
    // The actual tab switching and canvas loading happens in App.tsx via handleFileSwitch
    // but here we just need to trigger the state changes.
    window.dispatchEvent(new CustomEvent('devkarm:exit-project-graph', { detail: { fileId } }))
  }

  const cssVars = {
    '--region-color': color.border,
    '--region-bg': color.bg,
    '--region-text': color.text,
    '--region-glow': color.glow,
    '--region-color-hover': color.border.replace('0.4', '0.7'),
    '--region-header-bg': color.bg.replace('0.04', '0.08'),
    '--region-header-hover': color.bg.replace('0.04', '0.15'),
    '--region-badge-bg': color.bg.replace('0.04', '0.15'),
    '--region-badge-text': color.text,
  } as React.CSSProperties

  const [isDragOver, setIsDragOver] = React.useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (isUnresolved) return
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    // Actual drop is handled globally by ReactFlow in App.tsx due to how ReactFlow dnd works.
    // We add these to support potential HTML5 drag events.
  }

  return (
    <div
      className={`file-region-node${isUnresolved ? ' file-region-node--unresolved' : ''}${isDragOver ? ' file-region-node--drop-target' : ''}`}
      style={cssVars}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="file-region-node__drop-label">Drop here to move</div>
      )}

      <Handle type="target" position={Position.Top} id="target" style={{ opacity: 0 }} />

      <div className="file-region-node__header" onDoubleClick={handleHeaderDoubleClick} title="Double-click to navigate to file">
        <span className="file-region-node__icon">{icon}</span>
        <span className="file-region-node__filename">{fileName}</span>
        <span className="file-region-node__badge">
          {isUnresolved ? 'unresolved' : `${nodeCount} node${nodeCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {dependencies && dependencies.length > 0 && (
        <div className="file-region-node__deps">
          {dependencies.map((dep, i) => (
            <div key={i} className="file-region-node__dep-item">
              <span className="file-region-node__dep-arrow">→</span>
              <span>{dep.importedSymbol}</span>
              <span className="file-region-node__dep-path">from {dep.fromPath}</span>
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="source" style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(FileRegionNode)
