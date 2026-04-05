use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IGCNode {
    pub id: Uuid,
    pub parent_id: Option<Uuid>,
    pub project_id: Uuid,
    pub node_type: String,
    pub intent: serde_json::Value,
    pub graph: serde_json::Value,
    pub code: serde_json::Value,
    pub meta: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Body for POST /api/projects/:project_id/nodes
#[derive(Debug, Deserialize)]
pub struct CreateNode {
    pub id: Option<Uuid>,           // If provided, use as primary key (batch re-insert preserves IDs)
    pub node_type: Option<String>,
    pub intent: Option<serde_json::Value>,
    pub graph: Option<serde_json::Value>,
    pub code: Option<serde_json::Value>,
    pub parent_id: Option<Uuid>,
}

/// Body for PUT /api/nodes/:id
#[derive(Debug, Deserialize)]
pub struct UpdateNode {
    pub intent: Option<serde_json::Value>,
    pub graph: Option<serde_json::Value>,
    pub code: Option<serde_json::Value>,
    pub meta: Option<serde_json::Value>,
}
