use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize)]
pub struct SecretSafe {
    pub id: Uuid,
    pub project_id: Uuid,
    pub key_name: String,
    pub environment: String,
    pub created_by: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSecret {
    pub key_name: String,
    pub value: String,
    pub environment: Option<String>,
}

// Basic dummy encrypter for local dev
fn dummy_encrypt(val: &str) -> String {
    general_purpose::STANDARD.encode(val)
}

/// POST /api/projects/:project_id/secrets
pub async fn create_secret(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateSecret>,
) -> Result<(StatusCode, Json<SecretSafe>), StatusCode> {
    
    // In real prod, get user_id from token. We dummy it for local.
    let dummy_user_id = Uuid::new_v4();
    let enc_value = dummy_encrypt(&body.value);

    let row = sqlx::query!(
        r#"
        INSERT INTO secrets (project_id, key_name, encrypted_value, environment, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, project_id, key_name, environment, created_by, created_at, updated_at
        "#,
        project_id,
        body.key_name,
        enc_value,
        body.environment.clone().unwrap_or_else(|| "development".to_string()),
        dummy_user_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("create_secret: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok((StatusCode::CREATED, Json(SecretSafe {
        id: row.id,
        project_id: row.project_id,
        key_name: row.key_name,
        environment: row.environment.unwrap_or_else(|| "development".to_string()),
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })))
}

/// GET /api/projects/:project_id/secrets
pub async fn list_secrets(
    State(pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<SecretSafe>>, StatusCode> {
    let secrets = sqlx::query!(
        r#"
        SELECT id, project_id, key_name, environment, created_by, created_at, updated_at
        FROM secrets 
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
        project_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!("list_secrets: {e}");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let safes = secrets.into_iter().map(|row| SecretSafe {
        id: row.id,
        project_id: row.project_id,
        key_name: row.key_name,
        environment: row.environment.unwrap_or_default(),
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }).collect();

    Ok(Json(safes))
}

/// DELETE /api/secrets/:id
pub async fn delete_secret(
    State(pool): State<PgPool>,
    Path(secret_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM secrets WHERE id = $1")
        .bind(secret_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("delete_secret: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    Ok(StatusCode::NO_CONTENT)
}
