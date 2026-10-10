CREATE TABLE processed_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    record_index    INTEGER NOT NULL,
    data            JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'LOADED',
    error_message   TEXT,
    loaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processed_records_run_id ON processed_records (run_id);
CREATE INDEX idx_processed_records_status ON processed_records (run_id, status);
