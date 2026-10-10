from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI

from app.bootstrap import ensure_default_admin_key
from app.common.exceptions import register_exception_handlers
from app.config import get_settings
from app.database.postgres import async_session_factory
from app.database.redis import close_redis, init_redis
from app.middleware.cors import setup_cors
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.proxy.workflow_proxy import workflow_proxy
from app.routes.api_keys import router as api_keys_router
from app.routes.dead_letter import router as dead_letter_router
from app.routes.health import router as health_router
from app.routes.runs import router as runs_router
from app.routes.runs_actions import router as runs_actions_router
from app.routes.stats import router as stats_router
from app.routes.upload import router as upload_router
from app.routes.workflows import router as workflows_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_redis()
    await workflow_proxy.startup()
    settings = get_settings()
    try:
        async with async_session_factory() as db:
            await ensure_default_admin_key(db, settings)
    except Exception:
        logger.exception("Failed to seed default admin API key (DB may still be migrating)")
    logger.info("API gateway started")
    try:
        yield
    finally:
        await workflow_proxy.shutdown()
        await close_redis()
        logger.info("API gateway stopped")


app = FastAPI(title="Workflow API Gateway", lifespan=lifespan)
register_exception_handlers(app)
setup_cors(app)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestIdMiddleware)

app.include_router(health_router)
app.include_router(stats_router)
app.include_router(upload_router)
app.include_router(workflows_router)
app.include_router(runs_router)
app.include_router(runs_actions_router)
app.include_router(dead_letter_router)
app.include_router(api_keys_router)
