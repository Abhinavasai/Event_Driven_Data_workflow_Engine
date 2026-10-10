from __future__ import annotations

import asyncio
import logging

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from app.config import Settings
from app.consumer.event_handler import TransformEventHandler
from app.models.events import WorkflowEvent

logger = logging.getLogger(__name__)


class TransformStreamConsumer:
    def __init__(self, redis: Redis, settings: Settings) -> None:
        self.redis = redis
        self.settings = settings
        self.handler = TransformEventHandler(redis, settings)
        self._task: asyncio.Task | None = None
        self.running = False

    async def ensure_consumer_group(self) -> None:
        try:
            await self.redis.xgroup_create(
                self.settings.transform_stream,
                self.settings.consumer_group,
                id="0",
                mkstream=True,
            )
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def _consume_loop(self) -> None:
        await self.ensure_consumer_group()
        self.running = True
        logger.info(
            "Transform consumer started on %s group=%s",
            self.settings.transform_stream,
            self.settings.consumer_group,
        )
        while self.running:
            try:
                messages = await self.redis.xreadgroup(
                    groupname=self.settings.consumer_group,
                    consumername=self.settings.consumer_name,
                    streams={self.settings.transform_stream: ">"},
                    count=self.settings.read_count,
                    block=self.settings.block_ms,
                )
                if not messages:
                    continue
                for _stream, entries in messages:
                    for message_id, fields in entries:
                        await self._process_message(message_id, fields)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Consumer loop error")
                await asyncio.sleep(1)

    async def _process_message(self, message_id: str | bytes, fields: dict) -> None:
        decoded = {
            (k.decode() if isinstance(k, bytes) else k): (
                v.decode() if isinstance(v, bytes) else v
            )
            for k, v in fields.items()
        }
        event = WorkflowEvent.from_stream_fields(decoded)
        if event.event_type != "TRANSFORM_REQUESTED":
            await self.redis.xack(
                self.settings.transform_stream,
                self.settings.consumer_group,
                message_id,
            )
            return
        try:
            await self.handler.handle_transform_request(event)
            await self.redis.xack(
                self.settings.transform_stream,
                self.settings.consumer_group,
                message_id,
            )
        except Exception:
            logger.exception("Failed processing message %s", message_id)

    def start(self) -> asyncio.Task:
        self._task = asyncio.create_task(self._consume_loop())
        return self._task

    async def stop(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
