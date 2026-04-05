/**
 * awareness.ts — Y.js awareness protocol for user presence
 *
 * Tracks per-user state:
 *   - name:         display name (from Keycloak or random fallback)
 *   - color:        unique color for cursor/avatar
 *   - cursor:       { x, y } in canvas flow coordinates (null when off-canvas)
 *   - activeFileId: which file tab this user has open
 *
 * The awareness state is broadcast to all connected users in real-time.
 * It is ephemeral — not persisted to the database.
 */

import type { HocuspocusProvider } from '@hocuspocus/provider'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserAwareness {
  userId: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
  activeFileId: string | null
  /** Viewport state for Follow mode — { x, y, zoom } from React Flow's onMoveEnd */
  viewport: { x: number; y: number; zoom: number } | null
}

// ── Color palette for user presence ──────────────────────────────────────────
const PRESENCE_COLORS = [
  '#7C3AED', // violet
  '#2563EB', // blue
  '#059669', // green
  '#D97706', // amber
  '#DC2626', // red
  '#DB2777', // pink
  '#0891B2', // cyan
  '#65A30D', // lime
  '#7C2D12', // orange-deep
  '#4338CA', // indigo
]

function pickColor(userId: string): string {
  // Deterministic color based on userId so it's stable across reconnects
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0 // force int32
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

// ── Module-level state ────────────────────────────────────────────────────────
let _provider: HocuspocusProvider | null = null
let _localState: UserAwareness | null = null

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize awareness for the current user.
 * Must be called after initCollab().
 *
 * @param provider  The HocusPocus provider from initCollab(), or null if offline.
 *                  When null, awareness is set up locally but nothing is broadcast.
 * @param userId    Keycloak user ID (sub claim) or generated UUID
 * @param name      Display name (Keycloak preferred_username or email)
 */
export function initAwareness(
  provider: HocuspocusProvider | null,
  userId: string,
  name: string,
): void {
  _provider = provider

  _localState = {
    userId,
    name,
    color: pickColor(userId),
    cursor: null,
    activeFileId: null,
    viewport: null,
  }

  // Only broadcast if a provider exists (i.e. collab server is online)
  provider?.awareness?.setLocalStateField('user', _localState)
}

/**
 * Update the local user's cursor position (in React Flow canvas coordinates).
 * Pass null to indicate the cursor has left the canvas.
 */
export function updateCursor(position: { x: number; y: number } | null): void {
  if (!_provider?.awareness || !_localState) return

  _localState = { ..._localState, cursor: position }
  _provider.awareness.setLocalStateField('user', _localState)
}

/**
 * Update the local user's viewport (pan + zoom) for Follow mode.
 * Call from React Flow's onMoveEnd event.
 */
export function updateViewport(vp: { x: number; y: number; zoom: number } | null): void {
  if (!_provider?.awareness || !_localState) return

  _localState = { ..._localState, viewport: vp }
  _provider.awareness.setLocalStateField('user', _localState)
}

/**
 * Update which file the local user has active.
 * This lets remote users see which file each person is editing.
 */
export function updateActiveFile(fileId: string | null): void {
  if (!_provider?.awareness || !_localState) return

  _localState = { ..._localState, activeFileId: fileId }
  _provider.awareness.setLocalStateField('user', _localState)
}

/**
 * Get all remote users' awareness states (excluding the local user).
 */
export function getRemoteUsers(): UserAwareness[] {
  if (!_provider?.awareness) return []

  const states = _provider.awareness.getStates()
  const result: UserAwareness[] = []

  states.forEach((state, clientId) => {
    // Skip local client
    if (clientId === _provider!.awareness!.clientID) return
    if (state?.user) result.push(state.user as UserAwareness)
  })

  return result
}

/**
 * Get the local user's current awareness state.
 */
export function getLocalUser(): UserAwareness | null {
  return _localState
}

/**
 * Subscribe to awareness changes (any user joins, leaves, or moves cursor).
 * Returns an unsubscribe function.
 */
export function onAwarenessChange(callback: (users: UserAwareness[]) => void): () => void {
  if (!_provider?.awareness) return () => {}

  const handler = () => callback(getRemoteUsers())
  _provider.awareness.on('change', handler)

  return () => {
    _provider?.awareness?.off('change', handler)
  }
}

/**
 * Clean up awareness state. Call when destroyCollab() is called.
 */
export function destroyAwareness(): void {
  _provider = null
  _localState = null
}
