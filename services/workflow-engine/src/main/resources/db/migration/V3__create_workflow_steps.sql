CREATE TABLE workflow_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_name       VARCHAR(100) NOT NULL,
    step_type       VARCHAR(20) NOT NULL,
    step_order      INTEGER NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    output          JSONB,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    error_message   TEXT,
    duration_ms     BIGINT
);

CREATE INDEX idx_workflow_steps_run_id ON workflow_steps (run_id);
CREATE INDEX idx_workflow_steps_run_order ON workflow_steps (run_id, step_order);
CREATE INDEX idx_workflow_steps_status ON workflow_steps (status);
