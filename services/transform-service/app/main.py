from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from redis.asyncio import Redis

from app.api.health import router as health_router
from app.api.manual_transform import router as manual_transform_router
from app.api.metrics import router as metrics_router
from app.config import get_settings
from app.consumer.stream_consumer import TransformStreamConsumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=False)
    consumer = TransformStreamConsumer(redis, settings)
    app.state.settings = settings
    app.state.redis = redis
    app.state.consumer = consumer
    consumer.start()
    logger.info("Transform service started")
    try:
        yield
    finally:
        await consumer.stop()
        await redis.aclose()
        logger.info("Transform service stopped")


app = FastAPI(title="Transform Service", lifespan=lifespan)
app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(manual_transform_router)
