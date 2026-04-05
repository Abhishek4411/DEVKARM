-- Migration 003: Issues table for issue tracking & QA
-- Stores bug/issue records linked to canvas nodes (BugNode) within a project.

CREATE TABLE IF NOT EXISTS issues (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id     TEXT NOT NULL,              -- canvas BugNode id
    bug_id      VARCHAR(32) NOT NULL,       -- display id e.g. "BUG-1"
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    priority    VARCHAR(16) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status      VARCHAR(32) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in-progress', 'review', 'done')),
    assignee    TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_issues_project   ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_status    ON issues(project_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_priority  ON issues(project_id, priority);
CREATE INDEX IF NOT EXISTS idx_issues_node      ON issues(node_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_issues_updated_at();
