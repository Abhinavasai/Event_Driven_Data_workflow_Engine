CREATE TABLE dead_letter_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_name         VARCHAR(100) NOT NULL,
    event_data          JSONB NOT NULL,
    error_message       TEXT NOT NULL,
    original_timestamp  TIMESTAMPTZ NOT NULL,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed            BOOLEAN NOT NULL DEFAULT FALSE,
    replayed_at         TIMESTAMPTZ
);

CREATE INDEX idx_dead_letter_replayed ON dead_letter_events (replayed) WHERE replayed = FALSE;
CREATE INDEX idx_dead_letter_captured ON dead_letter_events (captured_at DESC);
CREATE INDEX idx_dead_letter_stream ON dead_letter_events (stream_name);
