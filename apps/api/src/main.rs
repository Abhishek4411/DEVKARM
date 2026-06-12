mod auth;
mod models;
mod routes;

use axum::{
    middleware,
    routing::{delete, get, put},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use auth::{new_jwks_cache, require_auth};

#[tokio::main]
async fn main() {
    // Load .env file
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "devkarm_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Connect to PostgreSQL
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    tracing::info!("Connected to database");

    // CORS: allow any localhost port (Vite may bind to 5173+ when ports are occupied)
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(
            |origin: &axum::http::HeaderValue, _| {
                origin.to_str().map_or(false, |o| {
                    o.starts_with("http://localhost:") || o.starts_with("http://127.0.0.1:")
                })
            },
        ))
        .allow_methods(Any)
        .allow_headers(Any);

    // JWKS cache shared across all requests
    let jwks_cache = new_jwks_cache();

    // Protected routes — require valid Keycloak JWT
    let protected = Router::new()
        // Projects
        .route(
            "/api/projects",
            get(routes::projects::list_projects).post(routes::projects::create_project),
        )
        .route(
            "/api/projects/{id}",
            get(routes::projects::get_project)
                .put(routes::projects::update_project)
                .delete(routes::projects::delete_project),
        )
        // IGC Nodes
        .route(
            "/api/projects/{project_id}/nodes",
            get(routes::nodes::list_nodes)
                .post(routes::nodes::create_node)
                .delete(routes::nodes::delete_all_nodes),
        )
        .route(
            "/api/nodes/{id}",
            put(routes::nodes::update_node).delete(routes::nodes::delete_node),
        )
        // Edges
        .route(
            "/api/projects/{project_id}/edges",
            get(routes::edges_routes::list_edges)
                .post(routes::edges_routes::create_edge)
                .delete(routes::edges_routes::delete_all_edges),
        )
        .route("/api/edges/{id}", delete(routes::edges_routes::delete_edge))
        // Execution Events (Replay Debugger)
        .route(
            "/api/projects/{id}/events",
            get(routes::events::list_events).post(routes::events::create_event),
        )
        // Issues (Issue Tracking & QA)
        .route(
            "/api/projects/{id}/issues",
            get(routes::issues::list_issues).post(routes::issues::create_issue),
        )
        .route(
            "/api/issues/{id}",
            get(routes::issues::get_issue)
                .put(routes::issues::update_issue)
                .delete(routes::issues::delete_issue),
        )
        // Secrets (Secret Vault)
        .route(
            "/api/projects/{id}/secrets",
            get(routes::secrets::list_secrets).post(routes::secrets::create_secret),
        )
        .route("/api/secrets/{id}", delete(routes::secrets::delete_secret))
        // Project Import
        .route(
            "/api/projects/{id}/import",
            axum::routing::post(routes::import::import_codebase),
        )
        // Apply JWT validation middleware to all routes above
        .layer(middleware::from_fn_with_state(
            jwks_cache.clone(),
            require_auth,
        ))
        .with_state(pool);

    let app = Router::new()
        // Health check — public, no auth
        .route("/api/health", get(health_check))
        .merge(protected)
        .layer(cors);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("DEVKARM API running on http://0.0.0.0:{port}");
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "status": "ok" }))
}
