CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    encrypted_value TEXT NOT NULL,
    environment VARCHAR(50) DEFAULT 'development',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, key_name, environment)
);
CREATE INDEX idx_secrets_project ON secrets(project_id);
