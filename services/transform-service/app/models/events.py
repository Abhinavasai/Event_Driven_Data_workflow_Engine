from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class TransformStepConfig(BaseModel):
    type: str
    config: dict[str, Any] = Field(default_factory=dict)


class TransformConfig(BaseModel):
    transformations: list[TransformStepConfig] = Field(default_factory=list)
    encoding: str = "utf-8"
    delimiter: str = ","


class TransformRequestedPayload(BaseModel):
    run_id: str
    step_id: str
    file_path: str
    file_type: str = "csv"
    row_count: int | None = None
    transform_config: TransformConfig | dict[str, Any]


class TransformStartedPayload(BaseModel):
    run_id: str
    step_id: str
    consumer_id: str


class TransformCompletedPayload(BaseModel):
    run_id: str
    step_id: str
    input_rows: int
    output_rows: int
    transformations_applied: list[str]
    cache_key: str
    cache_size_bytes: int
    cache_ttl_seconds: int
    duration_ms: int


class TransformFailedPayload(BaseModel):
    run_id: str
    step_id: str
    error_message: str
    error_type: str = "TransformationError"
    failed_transformation: str | None = None
    retry_count: int = 0
    max_retries: int = 3


class WorkflowEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    source_service: str = "transform-service"
    correlation_id: str
    payload: dict[str, Any]

    def to_stream_fields(self) -> dict[str, str]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "source_service": self.source_service,
            "correlation_id": self.correlation_id,
            "payload": json.dumps(self.payload),
        }

    @classmethod
    def from_stream_fields(cls, fields: dict[str, str]) -> WorkflowEvent:
        payload_raw = fields.get("payload", "{}")
        if isinstance(payload_raw, bytes):
            payload_raw = payload_raw.decode("utf-8")
        payload = json.loads(payload_raw) if payload_raw else {}
        return cls(
            event_id=fields.get("event_id", str(uuid4())),
            event_type=fields["event_type"],
            timestamp=fields.get("timestamp", datetime.now(UTC).isoformat()),
            source_service=fields.get("source_service", "workflow-engine"),
            correlation_id=fields.get("correlation_id", payload.get("run_id", "")),
            payload=payload,
        )
