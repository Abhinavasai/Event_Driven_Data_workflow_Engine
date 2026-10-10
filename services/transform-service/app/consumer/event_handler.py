from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

import pandas as pd
from redis.asyncio import Redis

from app.cache.redis_cache import RedisDataFrameCache
from app.config import Settings
from app.metrics_state import metrics
from app.models.events import (
    TransformCompletedPayload,
    TransformFailedPayload,
    TransformRequestedPayload,
    TransformStartedPayload,
    WorkflowEvent,
)
from app.transformer.pipeline import TransformPipeline

logger = logging.getLogger(__name__)


def _load_dataframe(file_path: str, file_type: str, transform_config: dict[str, Any]) -> pd.DataFrame:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    encoding = transform_config.get("encoding", "utf-8")
    if file_type.lower() == "json":
        return pd.read_json(path)
    delimiter = transform_config.get("delimiter", ",")
    return pd.read_csv(path, encoding=encoding, delimiter=delimiter)


async def publish_event(redis: Redis, stream: str, event: WorkflowEvent) -> str:
    message_id = await redis.xadd(stream, event.to_stream_fields())
    return message_id.decode() if isinstance(message_id, bytes) else str(message_id)


class TransformEventHandler:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self.redis = redis
        self.settings = settings
        self.cache = RedisDataFrameCache(
            redis,
            ttl_seconds=settings.cache_ttl_seconds,
            use_parquet=settings.cache_use_parquet,
        )

    async def execute_transform(
        self,
        run_id: str,
        file_path: str,
        file_type: str,
        transform_config: dict[str, Any],
    ) -> TransformCompletedPayload:
        df = _load_dataframe(file_path, file_type, transform_config)
        steps = transform_config.get("transformations", [])
        pipeline = TransformPipeline(steps=steps)
        start = time.perf_counter()
        result = pipeline.run(df)
        cache_key, cache_size = await self.cache.cache_dataframe(run_id, result.dataframe)
        metrics.record_cache_write()
        duration_ms = int((time.perf_counter() - start) * 1000)
        return TransformCompletedPayload(
            run_id=run_id,
            step_id="",
            input_rows=result.input_rows,
            output_rows=result.output_rows,
            transformations_applied=result.transformations_applied,
            cache_key=cache_key,
            cache_size_bytes=cache_size,
            cache_ttl_seconds=self.settings.cache_ttl_seconds,
            duration_ms=duration_ms,
        )

    async def handle_transform_request(self, event: WorkflowEvent) -> TransformCompletedPayload:
        payload = TransformRequestedPayload.model_validate(event.payload)
        run_id = payload.run_id
        step_id = payload.step_id
        transform_config = (
            payload.transform_config.model_dump()
            if hasattr(payload.transform_config, "model_dump")
            else dict(payload.transform_config)
        )
        started = WorkflowEvent(
            event_type="TRANSFORM_STARTED",
            correlation_id=run_id,
            payload=TransformStartedPayload(
                run_id=run_id,
                step_id=step_id,
                consumer_id=self.settings.consumer_name,
            ).model_dump(),
        )
        await publish_event(self.redis, self.settings.transform_stream, started)

        metrics.active_transforms += 1
        try:
            completed_payload = await self.execute_transform(
                run_id,
                payload.file_path,
                payload.file_type,
                transform_config,
            )
            completed_payload.step_id = step_id
            completed = WorkflowEvent(
                event_type="TRANSFORM_COMPLETED",
                correlation_id=run_id,
                payload=completed_payload.model_dump(),
            )
            await publish_event(self.redis, self.settings.transform_stream, completed)
            metrics.record_success(completed_payload.duration_ms)
            return completed_payload
        except Exception as exc:
            logger.exception("Transform failed for run %s", run_id)
            metrics.record_error()
            failed = WorkflowEvent(
                event_type="TRANSFORM_FAILED",
                correlation_id=run_id,
                payload=TransformFailedPayload(
                    run_id=run_id,
                    step_id=step_id,
                    error_message=str(exc),
                    failed_transformation=_guess_failed_step(transform_config, exc),
                    retry_count=0,
                    max_retries=3,
                ).model_dump(),
            )
            await publish_event(self.redis, self.settings.transform_stream, failed)
            raise
        finally:
            metrics.active_transforms = max(0, metrics.active_transforms - 1)


def _guess_failed_step(transform_config: dict[str, Any], exc: Exception) -> str | None:
    message = str(exc).lower()
    for step in transform_config.get("transformations", []):
        step_type = step.get("type")
        if step_type and step_type in message:
            return step_type
    return None


async def run_manual_transform(
    redis: Redis,
    settings: Settings,
    run_id: str,
    file_path: str,
    file_type: str,
    transform_config: dict[str, Any],
) -> dict[str, Any]:
    handler = TransformEventHandler(redis, settings)
    result = await handler.execute_transform(run_id, file_path, file_type, transform_config)
    return {
        "run_id": run_id,
        "status": "completed",
        "input_rows": result.input_rows,
        "output_rows": result.output_rows,
        "transformations_applied": result.transformations_applied,
        "cache_key": result.cache_key,
        "cache_size_bytes": result.cache_size_bytes,
        "duration_ms": result.duration_ms,
    }
