-- Migration 002: Execution Events for Replay Debugger

CREATE TABLE IF NOT EXISTS execution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    input_data JSONB,
    output_data JSONB,
    duration_ms REAL,
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_project ON execution_events(project_id);
CREATE INDEX IF NOT EXISTS idx_exec_node    ON execution_events(node_id);
CREATE INDEX IF NOT EXISTS idx_exec_created ON execution_events(created_at);
