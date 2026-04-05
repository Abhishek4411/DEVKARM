/**
 * HocusPocus sync server — ws://localhost:1234
 *
 * SECURITY: Every incoming WebSocket connection must present a valid Keycloak
 * RS256 JWT via the onAuthenticate hook. Unauthenticated connections are rejected.
 *
 * DEVELOPMENT BYPASS: Set SKIP_AUTH=true in your environment to allow connections
 * without a token. NEVER use this in production.
 *
 * Usage:
 *   node services/sync/server.js              # requires valid Keycloak token
 *   SKIP_AUTH=true node services/sync/server.js  # dev mode, no auth
 */

import { Server } from '@hocuspocus/server'
import jwt from 'jsonwebtoken'
import { createPublicKey } from 'crypto'

// ── Keycloak JWKS public key cache ────────────────────────────────────────────
const KEYCLOAK_CERTS_URL =
  'http://localhost:8080/realms/devkarm/protocol/openid-connect/certs'

/** Cached PEM-encoded RSA public key (fetched once from Keycloak on first auth). */
let _cachedPem = null
/** Track in-flight fetch so concurrent auth requests share one JWKS call. */
let _fetchingPem = null

/**
 * Fetch Keycloak's RSA public key and return it as a PEM string.
 * Cached after first successful fetch. Re-fetches on error.
 */
async function getKeycloakPem() {
  if (_cachedPem) return _cachedPem
  if (_fetchingPem) return _fetchingPem

  _fetchingPem = (async () => {
    const res = await fetch(KEYCLOAK_CERTS_URL)
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status} ${res.statusText}`)

    const jwks = await res.json()
    // Pick the first RSA signing key
    const signingKey =
      jwks.keys.find((k) => k.kty === 'RSA' && k.use === 'sig') ??
      jwks.keys.find((k) => k.kty === 'RSA') ??
      jwks.keys[0]

    if (!signingKey) throw new Error('No RSA key found in JWKS response')

    // Convert JWK → PEM using Node.js built-in crypto (Node 18+, no extra deps)
    const pubKey = createPublicKey({ key: signingKey, format: 'jwk' })
    _cachedPem = pubKey.export({ type: 'spki', format: 'pem' })
    return _cachedPem
  })()

  try {
    const pem = await _fetchingPem
    return pem
  } catch (err) {
    _fetchingPem = null  // allow retry on next auth attempt
    throw err
  } finally {
    _fetchingPem = null
  }
}

// ── HocusPocus server ─────────────────────────────────────────────────────────
const server = Server.configure({
  port: 1234,

  /**
   * JWT validation — called before the WebSocket connection is fully established.
   * Throwing here rejects the connection with a 403.
   */
  async onAuthenticate({ token, documentName }) {
    // ── Development bypass ──────────────────────────────────────────────────
    if (process.env.SKIP_AUTH === 'true') {
      console.log(`[sync] SKIP_AUTH=true — allowing unauthenticated connection to "${documentName}"`)
      return { userId: 'dev-user', email: 'dev@devkarm.io' }
    }

    // ── Require a token ─────────────────────────────────────────────────────
    if (!token) {
      throw new Error('Authentication required: no token provided')
    }

    // ── Validate JWT ────────────────────────────────────────────────────────
    try {
      const pem = await getKeycloakPem()
      const decoded = jwt.verify(token, pem, { algorithms: ['RS256'] })

      const userId = decoded.sub
      const email  = decoded.email ?? ''

      console.log(`[sync] Authenticated: userId=${userId} document="${documentName}"`)

      // Return user context — available in onConnect/onStoreDocument as context.auth
      return { userId, email }
    } catch (err) {
      // Re-fetch PEM on next attempt in case the key rotated
      _cachedPem = null
      throw new Error(`Authentication failed: ${err.message}`)
    }
  },

  async onConnect({ documentName, context }) {
    const userId = context?.auth?.userId ?? 'unknown'
    console.log(`[sync] Connected: userId=${userId} document="${documentName}"`)
  },

  async onDisconnect({ documentName, context }) {
    const userId = context?.auth?.userId ?? 'unknown'
    console.log(`[sync] Disconnected: userId=${userId} document="${documentName}"`)
  },

  async onStoreDocument({ documentName, document }) {
    // Placeholder — real persistence (Postgres) wired in a later phase
    const fileCount = document.getMap('files').size
    console.log(`[sync] Document saved: "${documentName}" (${fileCount} file entries)`)
  },

  async onLoadDocument({ documentName }) {
    console.log(`[sync] Document loaded: "${documentName}"`)
    // Return undefined — HocusPocus creates an empty Y.Doc on first load
  },
})

server.listen()
console.log('[sync] HocusPocus server running on ws://localhost:1234')
if (process.env.SKIP_AUTH === 'true') {
  console.warn('[sync] ⚠️  SKIP_AUTH=true — JWT validation is DISABLED. Do not use in production.')
} else {
  console.log('[sync] JWT auth enabled — Keycloak JWKS will be fetched on first connection.')
}
