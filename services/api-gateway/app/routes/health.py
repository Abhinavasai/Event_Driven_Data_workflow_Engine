import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.common.schemas import GatewayHealthResponse, HealthComponent
from app.config import get_settings
from app.database.postgres import engine
from app.database.redis import get_redis

router = APIRouter(prefix="/api/v1", tags=["health"])


async def _ping_url(url: str) -> HealthComponent:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                return HealthComponent(status="ok")
            return HealthComponent(status="degraded", detail=f"HTTP {response.status_code}")
    except Exception as exc:
        return HealthComponent(status="down", detail=str(exc))


@router.get("/health", response_model=GatewayHealthResponse)
async def health() -> GatewayHealthResponse:
    settings = get_settings()

    db_status = HealthComponent(status="ok")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = HealthComponent(status="down", detail=str(exc))

    redis_status = HealthComponent(status="ok")
    try:
        redis = await get_redis()
        if not await redis.ping():
            redis_status = HealthComponent(status="down", detail="ping failed")
    except Exception as exc:
        redis_status = HealthComponent(status="down", detail=str(exc))

    workflow = await _ping_url(f"{settings.workflow_engine_url}/internal/health")
    transform = await _ping_url(f"{settings.transform_service_url}/internal/health")

    overall = "ok"
    for component in (db_status, redis_status, workflow, transform):
        if component.status != "ok":
            overall = "degraded"
            break

    return GatewayHealthResponse(
        status=overall,
        database=db_status,
        redis=redis_status,
        workflow_engine=workflow,
        transform_service=transform,
    )
