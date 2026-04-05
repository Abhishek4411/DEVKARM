/**
 * Cursors.tsx — Real-time remote user cursor overlay
 *
 * Renders as a child of <ReactFlow> so it has access to useViewport().
 * Positioned absolutely over the canvas; converts Y.js awareness flow-coords
 * to canvas-container pixels using the current viewport transform.
 *
 * Viewport transform: containerX = flowX * zoom + vpX
 */

import { useEffect, useState, memo } from 'react'
import { useViewport } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAwarenessChange, type UserAwareness } from '../lib/awareness'
import './Cursors.css'

// ── Cursor arrow SVG ──────────────────────────────────────────────────────────
function CursorArrow({ color }: { color: string }) {
  return (
    <svg
      className="cursor-arrow"
      width="14"
      height="18"
      viewBox="0 0 14 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0 L0 14 L3.5 10.5 L6 16 L8 15 L5.5 9.5 L10.5 9.5 Z"
        fill={color}
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Single remote cursor ──────────────────────────────────────────────────────
const RemoteCursor = memo(function RemoteCursor({
  user,
  vpX,
  vpY,
  zoom,
}: {
  user: UserAwareness
  vpX: number
  vpY: number
  zoom: number
}) {
  if (!user.cursor) return null

  const x = user.cursor.x * zoom + vpX
  const y = user.cursor.y * zoom + vpY

  return (
    <motion.div
      className="remote-cursor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x, y }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 0.5 }}
      style={{ '--cursor-color': user.color } as React.CSSProperties}
    >
      <CursorArrow color={user.color} />
      <span className="cursor-label" style={{ background: user.color }}>
        {user.name}
      </span>
    </motion.div>
  )
})

// ── Main component (rendered as child of <ReactFlow>) ─────────────────────────
export default function Cursors() {
  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([])
  const { x: vpX, y: vpY, zoom } = useViewport()

  useEffect(() => {
    return onAwarenessChange(setRemoteUsers)
  }, [])

  const visibleUsers = remoteUsers.filter((u) => u.cursor !== null)

  if (visibleUsers.length === 0) return null

  return (
    <div className="cursors-overlay" aria-hidden="true">
      <AnimatePresence>
        {visibleUsers.map((u) => (
          <RemoteCursor key={u.userId} user={u} vpX={vpX} vpY={vpY} zoom={zoom} />
        ))}
      </AnimatePresence>
    </div>
  )
}
