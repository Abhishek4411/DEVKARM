use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct ExecutionEvent {
    pub id: Uuid,
    pub project_id: Uuid,
    pub node_id: String,
    pub event_type: String,
    pub input_data: Option<serde_json::Value>,
    pub output_data: Option<serde_json::Value>,
    pub duration_ms: Option<f32>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExecutionEvent {
    pub node_id: String,
    pub event_type: String,
    pub input_data: Option<serde_json::Value>,
    pub output_data: Option<serde_json::Value>,
    pub duration_ms: Option<f32>,
    pub error_message: Option<String>,
    pub stack_trace: Option<String>,
}
