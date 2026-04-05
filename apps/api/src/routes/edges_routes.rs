use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::edge::{CreateEdge, Edge};

pub async fn list_edges(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Edge>>, StatusCode> {
    let edges = sqlx::query_as::<_, Edge>(
        "SELECT * FROM edges WHERE project_id = $1 ORDER BY created_at ASC",
    )
    .bind(project_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("list_edges: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(edges))
}

pub async fn create_edge(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateEdge>,
) -> Result<(StatusCode, Json<Edge>), StatusCode> {
    let edge_type = body.edge_type.unwrap_or_else(|| "data".to_string());
    let properties = body.properties.unwrap_or_else(|| serde_json::json!({}));

    // Use caller-supplied id if present (batch re-insert preserves frontend IDs).
    let edge = sqlx::query_as::<_, Edge>(
        r#"
        INSERT INTO edges
            (id, project_id, source_node_id, source_port_id, target_node_id, target_port_id, edge_type, properties)
        VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(body.id)
    .bind(project_id)
    .bind(body.source_node_id)
    .bind(&body.source_port_id)
    .bind(body.target_node_id)
    .bind(&body.target_port_id)
    .bind(&edge_type)
    .bind(&properties)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_edge: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(edge)))
}

pub async fn delete_edge(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM edges WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_edge: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/projects/{project_id}/edges — wipe all edges for a project.
pub async fn delete_all_edges(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM edges WHERE project_id = $1")
        .bind(project_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_all_edges: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}
