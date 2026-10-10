from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import ApiKey
from app.auth.service import touch_api_key, validate_api_key
from app.database.postgres import get_db
from app.database.redis import get_redis

ROLE_RANK = {"viewer": 1, "operator": 2, "admin": 3}


async def get_api_key(
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> ApiKey:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    api_key = await validate_api_key(db, redis, x_api_key)
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    await touch_api_key(db, api_key)
    return api_key


def require_role(min_role: str) -> Callable:
    async def _dependency(api_key: ApiKey = Depends(get_api_key)) -> ApiKey:
        if ROLE_RANK.get(api_key.role, 0) < ROLE_RANK.get(min_role, 99):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return api_key

    return _dependency


RequireAdmin = Annotated[ApiKey, Depends(require_role("admin"))]
RequireOperator = Annotated[ApiKey, Depends(require_role("operator"))]
RequireViewer = Annotated[ApiKey, Depends(require_role("viewer"))]
