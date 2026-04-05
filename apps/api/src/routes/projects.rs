use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::project::{CreateProject, Project, UpdateProject};

pub async fn list_projects(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Project>>, StatusCode> {
    let projects = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects ORDER BY created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("list_projects: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(projects))
}

pub async fn get_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, StatusCode> {
    let project = sqlx::query_as::<_, Project>(
        "SELECT * FROM projects WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("get_project: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(project))
}

pub async fn create_project(
    State(pool): State<PgPool>,
    Extension(auth_user): Extension<AuthUser>,
    Json(body): Json<CreateProject>,
) -> Result<(StatusCode, Json<Project>), StatusCode> {
    let owner_id = Uuid::parse_str(&auth_user.user_id).map_err(|_| {
        tracing::error!("Invalid user_id UUID from token: {}", auth_user.user_id);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let project_type = body.project_type.unwrap_or_else(|| "web-app".to_string());

    let project = sqlx::query_as::<_, Project>(
        r#"
        INSERT INTO projects (name, description, owner_id, project_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(owner_id)
    .bind(&project_type)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_project: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn update_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProject>,
) -> Result<Json<Project>, StatusCode> {
    let project = sqlx::query_as::<_, Project>(
        r#"
        UPDATE projects
        SET
            name        = COALESCE($2, name),
            description = COALESCE($3, description),
            updated_at  = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.description)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("update_project: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(project))
}

pub async fn delete_project(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM projects WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_project: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
