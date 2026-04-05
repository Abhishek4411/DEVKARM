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
 *
 * OFFLINE MODE: If the HocusPocus sync server at ws://localhost:1234 is not
 * running, initCollab() performs a 1-second health check first. If the server
 * is unreachable, NO WebSocket provider is created — so there are zero retry
 * attempts and zero console errors. The Y.Doc is still created (so local-only
 * Y.js operations work), but collaboration is silently disabled.
 */

import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

// ── Module-level singleton state ──────────────────────────────────────────────
let _doc:      Y.Doc | null = null
let _provider: HocuspocusProvider | null = null
let _yFiles:   Y.Map<Y.Map<Y.Map<string> | Y.Text>> | null = null
let _tokenRefreshInterval: ReturnType<typeof setInterval> | null = null

const COLLAB_WS     = 'ws://localhost:1234'
const COLLAB_HEALTH = 'http://localhost:1234'

// ── Health check ──────────────────────────────────────────────────────────────

/**
 * Returns true if the HocusPocus server responds within 1 second.
 * Used to decide whether to create a WebSocket provider at all.
 * If the server is down, we never create the provider — so there are no
 * WebSocket retry loops or "WebSocket connection failed" console spam.
 */
async function isSyncServerAvailable(): Promise<boolean> {
  try {
    await fetch(COLLAB_HEALTH, {
      method: 'HEAD',
      signal: AbortSignal.timeout(1000),
    })
    return true
  } catch {
    return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize collaboration for a project.
 *
 * Always creates a Y.Doc (needed for local Y.js state even when offline).
 * Only creates a HocusPocus provider if the sync server is reachable.
 *
 * @param token  Keycloak JWT access token. Pass undefined for dev without Keycloak.
 */
export function initCollab(
  projectId: string,
  token?: string,
): {
  doc:      Y.Doc
  provider: HocuspocusProvider | null
  yFiles:   Y.Map<Y.Map<Y.Map<string> | Y.Text>>
} {
  // Clean up any existing session first
  destroyCollab()

  _doc    = new Y.Doc()
  _yFiles = _doc.getMap<Y.Map<Y.Map<string> | Y.Text>>('files')

  // Async: health check → create provider only if server is up.
  // We return synchronously with provider=null; callers that need the provider
  // should use getProvider() after the async phase completes.
  isSyncServerAvailable().then((available) => {
    if (!available) {
      console.log('[collab] Sync server not available — working offline (collaboration disabled)')
      return
    }

    // Server is up — create the provider and connect immediately.
    _provider = new HocuspocusProvider({
      url:      COLLAB_WS,
      name:     projectId,
      document: _doc!,
      token:    token ?? '',
      onConnect: () => {
        console.log(`[collab] Connected — project: ${projectId}`)
      },
      onDisconnect: () => {
        console.log(`[collab] Disconnected — project: ${projectId}`)
      },
      onSynced: () => {
        console.log(`[collab] Synced — project: ${projectId}`)
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error(`[collab] Auth failed: ${reason}`)
      },
    })
  })

  return { doc: _doc, provider: null, yFiles: _yFiles }
}

/**
 * Update the JWT token used by the active provider.
 * Call this when Keycloak silently refreshes the access token.
 */
export function updateCollabToken(newToken: string): void {
  if (!_provider) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(_provider as any).configuration.token = newToken
}

/**
 * Start a 4-minute interval that silently refreshes the Keycloak token.
 * Call after initCollab() succeeds.
 */
export function startTokenRefresh(refreshFn: () => Promise<string>): void {
  stopTokenRefresh()
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

export function getYNodes(fileId: string): Y.Map<string> {
  return getFileMap(fileId).get('nodes') as Y.Map<string>
}

export function getYEdges(fileId: string): Y.Map<string> {
  return getFileMap(fileId).get('edges') as Y.Map<string>
}

export function getYCode(fileId: string): Y.Text {
  return getFileMap(fileId).get('code') as Y.Text
}

/**
 * Destroy the current collab session and clean up all resources.
 */
export function destroyCollab(): void {
  stopTokenRefresh()
  try { _provider?.destroy() } catch { /* ignore */ }
  try { _doc?.destroy() }      catch { /* ignore */ }
  _doc      = null
  _provider = null
  _yFiles   = null
}

// ── Accessors ─────────────────────────────────────────────────────────────────
export function getDoc():      Y.Doc | null                                         { return _doc }
export function getProvider(): HocuspocusProvider | null                            { return _provider }
export function getYFiles():   Y.Map<Y.Map<Y.Map<string> | Y.Text>> | null         { return _yFiles }
export function isCollabActive(): boolean { return _doc !== null && _provider !== null }
