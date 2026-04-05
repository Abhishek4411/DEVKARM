use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::execution_event::{CreateExecutionEvent, ExecutionEvent};

/// POST /api/projects/:id/events
/// Store a single execution event for a project.
pub async fn create_event(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateExecutionEvent>,
) -> Result<(StatusCode, Json<ExecutionEvent>), StatusCode> {
    let event = sqlx::query_as::<_, ExecutionEvent>(
        r#"
        INSERT INTO execution_events
            (project_id, node_id, event_type, input_data, output_data, duration_ms, error_message, stack_trace)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(project_id)
    .bind(&body.node_id)
    .bind(&body.event_type)
    .bind(&body.input_data)
    .bind(&body.output_data)
    .bind(body.duration_ms)
    .bind(&body.error_message)
    .bind(&body.stack_trace)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_event: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(event)))
}

#[derive(Debug, Deserialize)]
pub struct EventsQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

/// GET /api/projects/:id/events?from=<timestamp>&to=<timestamp>
/// Query execution events for a project within an optional time range.
pub async fn list_events(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Query(params): Query<EventsQuery>,
) -> Result<Json<Vec<ExecutionEvent>>, StatusCode> {
    let events = match (params.from, params.to) {
        (Some(from), Some(to)) => {
            sqlx::query_as::<_, ExecutionEvent>(
                r#"
                SELECT * FROM execution_events
                WHERE project_id = $1
                  AND created_at >= $2
                  AND created_at <= $3
                ORDER BY created_at ASC
                "#,
            )
            .bind(project_id)
            .bind(from)
            .bind(to)
            .fetch_all(&pool)
            .await
        }
        (Some(from), None) => {
            sqlx::query_as::<_, ExecutionEvent>(
                "SELECT * FROM execution_events WHERE project_id = $1 AND created_at >= $2 ORDER BY created_at ASC",
            )
            .bind(project_id)
            .bind(from)
            .fetch_all(&pool)
            .await
        }
        (None, Some(to)) => {
            sqlx::query_as::<_, ExecutionEvent>(
                "SELECT * FROM execution_events WHERE project_id = $1 AND created_at <= $2 ORDER BY created_at ASC",
            )
            .bind(project_id)
            .bind(to)
            .fetch_all(&pool)
            .await
        }
        (None, None) => {
            sqlx::query_as::<_, ExecutionEvent>(
                "SELECT * FROM execution_events WHERE project_id = $1 ORDER BY created_at ASC",
            )
            .bind(project_id)
            .fetch_all(&pool)
            .await
        }
    }
    .map_err(|e| {
        tracing::error!("list_events: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(events))
}
