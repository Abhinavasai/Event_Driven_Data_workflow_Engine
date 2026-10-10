CREATE TABLE system_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    source_service  VARCHAR(50) NOT NULL,
    payload         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_events_type ON system_events (event_type);
CREATE INDEX idx_system_events_created ON system_events (created_at DESC);
CREATE INDEX idx_system_events_source ON system_events (source_service);
