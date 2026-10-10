CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id   UUID NOT NULL REFERENCES workflow_definitions(id),
    file_name       VARCHAR(500) NOT NULL,
    file_path       VARCHAR(1000) NOT NULL,
    file_size       BIGINT,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    input_config    JSONB,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_by      VARCHAR(100),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_status ON workflow_runs (status);
CREATE INDEX idx_workflow_runs_definition ON workflow_runs (definition_id);
CREATE INDEX idx_workflow_runs_created_at ON workflow_runs (created_at DESC);
CREATE INDEX idx_workflow_runs_file_name ON workflow_runs (file_name);
CREATE INDEX idx_workflow_runs_status_created ON workflow_runs (status, created_at DESC);
