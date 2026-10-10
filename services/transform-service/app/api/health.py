from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/internal/health")
async def health(request: Request) -> dict:
    redis = request.app.state.redis
    consumer = request.app.state.consumer
    redis_ok = False
    try:
        redis_ok = await redis.ping()
    except Exception:
        redis_ok = False
    status = "ok" if redis_ok else "degraded"
    return {
        "status": status,
        "redis": "connected" if redis_ok else "disconnected",
        "consumer_running": getattr(consumer, "running", False),
    }
