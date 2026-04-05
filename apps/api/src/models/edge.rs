use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Edge {
    pub id: Uuid,
    pub project_id: Uuid,
    pub source_node_id: Uuid,
    pub source_port_id: String,
    pub target_node_id: Uuid,
    pub target_port_id: String,
    pub edge_type: Option<String>,
    pub properties: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

/// Body for POST /api/projects/:project_id/edges
#[derive(Debug, Deserialize)]
pub struct CreateEdge {
    pub id: Option<Uuid>,           // If provided, use as primary key (batch re-insert preserves IDs)
    pub source_node_id: Uuid,
    pub source_port_id: String,
    pub target_node_id: Uuid,
    pub target_port_id: String,
    pub edge_type: Option<String>,
    pub properties: Option<serde_json::Value>,
}
