/**
 * collab.ts — Y.js + HocusPocus real-time collaboration
 *
 * CRITICAL ARCHITECTURE: Uses a NESTED yFiles structure, NOT flat yNodes/yEdges.
 * Each file is a Y.Map keyed by fileId containing:
 *   nodes: Y.Map<string>  (nodeId → JSON string of node data)
 *   edges: Y.Map<string>  (edgeId → JSON string of edge data)
 *   code:  Y.Text         (shared code string)
 *
 * This prevents User A switching tabs from wiping User B's nodes.
 */

import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

// ── Module-level singleton state ──────────────────────────────────────────────
let _doc: Y.Doc | null = null
let _provider: HocuspocusProvider | null = null
let _yFiles: Y.Map<Y.Map<Y.Map<string> | Y.Text>> | null = null
let _tokenRefreshInterval: ReturnType<typeof setInterval> | null = null

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize collaboration for a project.
 * Creates a Y.Doc and HocusPocus provider connected to ws://localhost:1234.
 * Document name = projectId (UUID).
 *
 * @param token  Keycloak JWT access token. Sent to HocusPocus onAuthenticate hook.
 *               Pass undefined to connect without auth (dev only — server must have SKIP_AUTH=true).
 */
export function initCollab(
  projectId: string,
  token?: string,
): {
  doc: Y.Doc
  provider: HocuspocusProvider
  yFiles: Y.Map<Y.Map<Y.Map<string> | Y.Text>>
} {
  // Clean up any existing session first
  destroyCollab()

  _doc = new Y.Doc()

  _provider = new HocuspocusProvider({
    url: 'ws://localhost:1234',
    name: projectId,
    document: _doc,
    // Keycloak JWT — sent to server's onAuthenticate hook.
    // If undefined, the server must have SKIP_AUTH=true.
    token: token ?? '',
    onConnect: () => {
      console.log(`[collab] Connected to project: ${projectId}`)
    },
    onDisconnect: () => {
      console.log(`[collab] Disconnected from project: ${projectId}`)
    },
    onSynced: () => {
      console.log(`[collab] Document synced: ${projectId}`)
    },
    onAuthenticationFailed: ({ reason }) => {
      console.error(`[collab] Authentication failed: ${reason}`)
    },
  })

  _yFiles = _doc.getMap<Y.Map<Y.Map<string> | Y.Text>>('files')

  return { doc: _doc, provider: _provider, yFiles: _yFiles }
}

/**
 * Update the JWT token used by the active provider.
 * Call this when Keycloak silently refreshes the access token.
 * Takes effect on the next reconnect if the connection is currently live.
 */
export function updateCollabToken(newToken: string): void {
  if (!_provider) return
  // HocusPocus provider stores config on the instance — update it so any
  // reconnect attempt (after disconnect/network drop) uses the fresh token.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(_provider as any).configuration.token = newToken
}

/**
 * Start a 4-minute interval that silently refreshes the Keycloak token and
 * updates the provider. Call after initCollab().
 *
 * @param getToken   Returns the current (possibly stale) token string
 * @param refreshFn  Calls Keycloak to refresh; returns the fresh token (or throws)
 */
export function startTokenRefresh(
  refreshFn: () => Promise<string>,
): void {
  stopTokenRefresh()
  // Refresh every 4 minutes (Keycloak default token lifetime is 5 minutes)
  _tokenRefreshInterval = setInterval(async () => {
    try {
      const freshToken = await refreshFn()
      updateCollabToken(freshToken)
    } catch (err) {
      console.warn('[collab] Token refresh failed:', err)
    }
  }, 4 * 60 * 1000)
}

/** Stop the token refresh interval. Called by destroyCollab(). */
export function stopTokenRefresh(): void {
  if (_tokenRefreshInterval !== null) {
    clearInterval(_tokenRefreshInterval)
    _tokenRefreshInterval = null
  }
}

/**
 * Get (or create) the Y.Map for a specific file.
 * Structure: { nodes: Y.Map<string>, edges: Y.Map<string>, code: Y.Text }
 *
 * Call this when:
 * - Creating a new file tab
 * - Switching to a file tab (to bind observers)
 */
export function getFileMap(fileId: string): Y.Map<Y.Map<string> | Y.Text> {
  if (!_yFiles || !_doc) {
    throw new Error('[collab] Not initialized — call initCollab() first')
  }

  if (!_yFiles.has(fileId)) {
    _doc.transact(() => {
      const fileMap = new Y.Map<Y.Map<string> | Y.Text>()
      fileMap.set('nodes', new Y.Map<string>())
      fileMap.set('edges', new Y.Map<string>())
      fileMap.set('code', new Y.Text())
      _yFiles!.set(fileId, fileMap)
    })
  }

  return _yFiles.get(fileId)!
}

/**
 * Get the shared nodes map for a file.
 * Maps nodeId → JSON.stringify(AppNode)
 */
export function getYNodes(fileId: string): Y.Map<string> {
  return getFileMap(fileId).get('nodes') as Y.Map<string>
}

/**
 * Get the shared edges map for a file.
 * Maps edgeId → JSON.stringify(Edge)
 */
export function getYEdges(fileId: string): Y.Map<string> {
  return getFileMap(fileId).get('edges') as Y.Map<string>
}

/**
 * Get the shared code text for a file.
 */
export function getYCode(fileId: string): Y.Text {
  return getFileMap(fileId).get('code') as Y.Text
}

/**
 * Destroy the current collab session and clean up all resources.
 * Call this when:
 * - User navigates away from a project
 * - Component unmounts
 */
export function destroyCollab(): void {
  stopTokenRefresh()
  try {
    _provider?.destroy()
  } catch {
    // ignore errors during cleanup
  }
  try {
    _doc?.destroy()
  } catch {
    // ignore errors during cleanup
  }
  _doc = null
  _provider = null
  _yFiles = null
}

// ── Accessor for current instances (null if not initialized) ──────────────────
export function getDoc(): Y.Doc | null { return _doc }
export function getProvider(): HocuspocusProvider | null { return _provider }
export function getYFiles(): Y.Map<Y.Map<Y.Map<string> | Y.Text>> | null { return _yFiles }
export function isCollabActive(): boolean { return _doc !== null && _provider !== null }
