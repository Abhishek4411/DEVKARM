use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::issue::{CreateIssue, Issue, UpdateIssue};

/// GET /api/projects/:id/issues?status=open&priority=high
pub async fn list_issues(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Query(params): Query<IssuesQuery>,
) -> Result<Json<Vec<Issue>>, StatusCode> {
    // Dynamic filtering via a simple WHERE builder
    let mut conditions = vec!["project_id = $1".to_string()];
    let mut binds: Vec<String> = vec![project_id.to_string()];

    if let Some(ref s) = params.status {
        binds.push(s.clone());
        conditions.push(format!("status = ${}", binds.len()));
    }
    if let Some(ref p) = params.priority {
        binds.push(p.clone());
        conditions.push(format!("priority = ${}", binds.len()));
    }

    let sql = format!(
        "SELECT * FROM issues WHERE {} ORDER BY created_at DESC",
        conditions.join(" AND ")
    );

    // Build the query with dynamic binds
    let mut q = sqlx::query_as::<_, Issue>(&sql).bind(project_id);
    if let Some(ref s) = params.status {
        q = q.bind(s);
    }
    if let Some(ref p) = params.priority {
        q = q.bind(p);
    }

    let issues = q.fetch_all(&pool).await.map_err(|e| {
        tracing::error!("list_issues: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(issues))
}

/// POST /api/projects/:id/issues
pub async fn create_issue(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateIssue>,
) -> Result<(StatusCode, Json<Issue>), StatusCode> {
    let issue = sqlx::query_as::<_, Issue>(
        r#"
        INSERT INTO issues (project_id, node_id, bug_id, title, description, priority, status, assignee)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(project_id)
    .bind(&body.node_id)
    .bind(&body.bug_id)
    .bind(&body.title)
    .bind(body.description.as_deref().unwrap_or(""))
    .bind(body.priority.as_deref().unwrap_or("medium"))
    .bind(body.status.as_deref().unwrap_or("open"))
    .bind(body.assignee.as_deref().unwrap_or(""))
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_issue: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(issue)))
}

/// GET /api/issues/:id
pub async fn get_issue(
    State(pool): State<PgPool>,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<Issue>, StatusCode> {
    let issue = sqlx::query_as::<_, Issue>("SELECT * FROM issues WHERE id = $1")
        .bind(issue_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!("get_issue: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(issue))
}

/// PUT /api/issues/:id
pub async fn update_issue(
    State(pool): State<PgPool>,
    Path(issue_id): Path<Uuid>,
    Json(body): Json<UpdateIssue>,
) -> Result<Json<Issue>, StatusCode> {
    let issue = sqlx::query_as::<_, Issue>(
        r#"
        UPDATE issues SET
            title       = COALESCE($2, title),
            description = COALESCE($3, description),
            priority    = COALESCE($4, priority),
            status      = COALESCE($5, status),
            assignee    = COALESCE($6, assignee)
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(issue_id)
    .bind(body.title.as_deref())
    .bind(body.description.as_deref())
    .bind(body.priority.as_deref())
    .bind(body.status.as_deref())
    .bind(body.assignee.as_deref())
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("update_issue: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(issue))
}

/// DELETE /api/issues/:id
pub async fn delete_issue(
    State(pool): State<PgPool>,
    Path(issue_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM issues WHERE id = $1")
        .bind(issue_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_issue: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct IssuesQuery {
    pub status:   Option<String>,
    pub priority: Option<String>,
}
