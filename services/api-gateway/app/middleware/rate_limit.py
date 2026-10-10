import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings
from app.database.redis import get_redis


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/v1/health":
            return await call_next(request)

        settings = get_settings()
        api_key = request.headers.get("X-API-Key", "anonymous")
        redis = await get_redis()
        now = time.time()
        window_start = now - settings.rate_limit_window_seconds
        key = f"rate_limit:{api_key}"

        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, settings.rate_limit_window_seconds)
        _, _, count, _ = await pipe.execute()

        if int(count) > settings.rate_limit_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
            )

        return await call_next(request)
