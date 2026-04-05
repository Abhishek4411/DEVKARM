/**
 * PresenceBar.tsx — Real-time user presence indicator for the top bar
 *
 * Shows a row of colored avatar circles — one per connected collaborator.
 * - Local user: green online dot
 * - Remote user: click to open popover with Follow / Unfollow button
 * - Follow mode: your viewport tracks the followed user's pan + zoom
 */

import { useState, useEffect, useRef, memo } from 'react'
import { getLocalUser, onAwarenessChange, type UserAwareness } from '../lib/awareness'
import './PresenceBar.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

// ── Single avatar button ──────────────────────────────────────────────────────
const Avatar = memo(function Avatar({
  user,
  isLocal,
  isFollowed,
  onClickRemote,
}: {
  user: UserAwareness
  isLocal: boolean
  isFollowed: boolean
  onClickRemote: () => void
}) {
  return (
    <button
      className={`presence-avatar${isFollowed ? ' presence-avatar--followed' : ''}`}
      style={{ background: user.color }}
      onClick={isLocal ? undefined : onClickRemote}
      title={isLocal ? `${user.name} (you)` : user.name}
      aria-label={isLocal ? `${user.name} (you)` : user.name}
    >
      {getInitials(user.name)}
      {isLocal && <span className="presence-online-dot" aria-hidden="true" />}
      {isFollowed && <span className="presence-following-ring" aria-hidden="true" />}
    </button>
  )
})

// ── Popover for remote users ──────────────────────────────────────────────────
function UserPopover({
  user,
  isFollowing,
  onFollow,
  onClose,
}: {
  user: UserAwareness
  isFollowing: boolean
  onFollow: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="presence-popover" ref={ref} role="dialog" aria-label={`User: ${user.name}`}>
      <div className="presence-popover-header">
        <span
          className="presence-popover-dot"
          style={{ background: user.color }}
          aria-hidden="true"
        />
        <span className="presence-popover-name">{user.name}</span>
      </div>
      {user.activeFileId && (
        <div className="presence-popover-file" title={user.activeFileId}>
          {user.activeFileId.replace(/^file-/, '').replace(/^\d+-/, '')}
        </div>
      )}
      <button
        className={`presence-follow-btn${isFollowing ? ' presence-follow-btn--active' : ''}`}
        onClick={onFollow}
      >
        {isFollowing ? 'Unfollow' : 'Follow'}
      </button>
    </div>
  )
}

// ── PresenceBar ───────────────────────────────────────────────────────────────

interface PresenceBarProps {
  followingUserId: string | null
  onFollow: (userId: string | null) => void
}

export default function PresenceBar({ followingUserId, onFollow }: PresenceBarProps) {
  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([])
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const localUser = getLocalUser()

  useEffect(() => {
    return onAwarenessChange(setRemoteUsers)
  }, [])

  // No local user yet (collab not initialized) — render nothing
  if (!localUser) return null

  function handleFollow(userId: string) {
    const next = followingUserId === userId ? null : userId
    onFollow(next)
    setOpenPopover(null)
  }

  return (
    <div className="presence-bar" aria-label="Connected users">
      {/* Local user always first */}
      <div className="presence-avatar-slot">
        <Avatar
          user={localUser}
          isLocal
          isFollowed={false}
          onClickRemote={() => {}}
        />
      </div>

      {/* Remote users */}
      {remoteUsers.map((u) => (
        <div key={u.userId} className="presence-avatar-slot">
          <Avatar
            user={u}
            isLocal={false}
            isFollowed={followingUserId === u.userId}
            onClickRemote={() =>
              setOpenPopover(openPopover === u.userId ? null : u.userId)
            }
          />
          {openPopover === u.userId && (
            <UserPopover
              user={u}
              isFollowing={followingUserId === u.userId}
              onFollow={() => handleFollow(u.userId)}
              onClose={() => setOpenPopover(null)}
            />
          )}
        </div>
      ))}

      {/* "Following..." badge */}
      {followingUserId && (
        <div className="presence-following-badge">
          Following…
          <button
            className="presence-following-stop"
            onClick={() => onFollow(null)}
            title="Stop following (Esc)"
            aria-label="Stop following"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
