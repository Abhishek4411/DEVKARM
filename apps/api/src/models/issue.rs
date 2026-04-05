use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Row returned from the `issues` table.
#[derive(Debug, FromRow, Serialize)]
pub struct Issue {
    pub id:          Uuid,
    pub project_id:  Uuid,
    pub node_id:     String,
    pub bug_id:      String,
    pub title:       String,
    pub description: String,
    pub priority:    String,
    pub status:      String,
    pub assignee:    String,
    pub created_at:  DateTime<Utc>,
    pub updated_at:  DateTime<Utc>,
}

/// Payload for POST /api/projects/:id/issues
#[derive(Debug, Deserialize)]
pub struct CreateIssue {
    pub node_id:     String,
    pub bug_id:      String,
    pub title:       String,
    pub description: Option<String>,
    pub priority:    Option<String>,
    pub status:      Option<String>,
    pub assignee:    Option<String>,
}

/// Payload for PUT /api/issues/:id
#[derive(Debug, Deserialize)]
pub struct UpdateIssue {
    pub title:       Option<String>,
    pub description: Option<String>,
    pub priority:    Option<String>,
    pub status:      Option<String>,
    pub assignee:    Option<String>,
}
