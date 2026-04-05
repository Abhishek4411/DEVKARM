use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Claims we care about from the Keycloak JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
    pub preferred_username: Option<String>,
}

/// Authenticated user injected into request extensions by the middleware.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub email: Option<String>,
}

/// Shared JWKS cache: keyed by `kid`.
pub type JwksCache = Arc<RwLock<Option<JwkSet>>>;

pub fn new_jwks_cache() -> JwksCache {
    Arc::new(RwLock::new(None))
}

const JWKS_URL: &str = "http://localhost:8080/realms/devkarm/protocol/openid-connect/certs";
const ISSUER: &str = "http://localhost:8080/realms/devkarm";

/// Fetch and cache the Keycloak JWKS.
async fn fetch_jwks(cache: &JwksCache) -> Result<JwkSet, StatusCode> {
    // Fast path: already cached
    {
        let guard = cache.read().await;
        if let Some(ref set) = *guard {
            return Ok(set.clone());
        }
    }

    // Slow path: fetch from Keycloak
    let set = reqwest::get(JWKS_URL)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch JWKS: {e}");
            StatusCode::SERVICE_UNAVAILABLE
        })?
        .json::<JwkSet>()
        .await
        .map_err(|e| {
            tracing::error!("Failed to parse JWKS: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    *cache.write().await = Some(set.clone());
    Ok(set)
}

/// Axum middleware: validates the Keycloak JWT and injects `AuthUser` into extensions.
pub async fn require_auth(
    axum::extract::State(cache): axum::extract::State<JwksCache>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract bearer token from Authorization header
    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // Decode JWT header to get the key id (kid)
    let header = decode_header(token).map_err(|e| {
        tracing::warn!("Invalid JWT header: {e}");
        StatusCode::UNAUTHORIZED
    })?;

    let kid = header.kid.ok_or_else(|| {
        tracing::warn!("JWT missing kid");
        StatusCode::UNAUTHORIZED
    })?;

    // Fetch the JWKS (from cache or Keycloak)
    let jwks = fetch_jwks(&cache).await?;

    // Find the matching key
    let jwk = jwks.find(&kid).ok_or_else(|| {
        tracing::warn!("No matching JWK for kid={kid}");
        StatusCode::UNAUTHORIZED
    })?;

    let decoding_key = DecodingKey::from_jwk(jwk).map_err(|e| {
        tracing::error!("Failed to build DecodingKey: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Validate the token
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[ISSUER]);
    validation.set_audience(&["account"]);

    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|e| {
            tracing::warn!("JWT validation failed: {e}");
            StatusCode::UNAUTHORIZED
        })?;

    // Inject auth user into request extensions
    req.extensions_mut().insert(AuthUser {
        user_id: token_data.claims.sub,
        email: token_data.claims.email,
    });

    Ok(next.run(req).await)
}
