use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::igc_node::{CreateNode, IGCNode, UpdateNode};

pub async fn list_nodes(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<IGCNode>>, StatusCode> {
    let nodes = sqlx::query_as::<_, IGCNode>(
        "SELECT * FROM igc_nodes WHERE project_id = $1 ORDER BY created_at ASC",
    )
    .bind(project_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("list_nodes: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(nodes))
}

pub async fn create_node(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateNode>,
) -> Result<(StatusCode, Json<IGCNode>), StatusCode> {
    let node_type = body.node_type.unwrap_or_else(|| "function".to_string());
    let intent = body.intent.unwrap_or_else(|| serde_json::json!({}));
    let graph = body.graph.unwrap_or_else(|| serde_json::json!({}));
    let code = body.code.unwrap_or_else(|| serde_json::json!({}));

    // Use caller-supplied id if present (batch re-insert preserves frontend IDs),
    // otherwise generate a new UUID in the database.
    let node = sqlx::query_as::<_, IGCNode>(
        r#"
        INSERT INTO igc_nodes (id, project_id, parent_id, node_type, intent, graph, code)
        VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(body.id)
    .bind(project_id)
    .bind(body.parent_id)
    .bind(&node_type)
    .bind(&intent)
    .bind(&graph)
    .bind(&code)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_node: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(node)))
}

pub async fn update_node(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateNode>,
) -> Result<Json<IGCNode>, StatusCode> {
    let node = sqlx::query_as::<_, IGCNode>(
        r#"
        UPDATE igc_nodes
        SET
            intent     = COALESCE($2, intent),
            graph      = COALESCE($3, graph),
            code       = COALESCE($4, code),
            meta       = COALESCE($5, meta),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&body.intent)
    .bind(&body.graph)
    .bind(&body.code)
    .bind(&body.meta)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("update_node: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(node))
}

pub async fn delete_node(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM igc_nodes WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_node: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/projects/{project_id}/nodes — wipe all nodes for a project (edges cascade).
pub async fn delete_all_nodes(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM igc_nodes WHERE project_id = $1")
        .bind(project_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_all_nodes: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}
