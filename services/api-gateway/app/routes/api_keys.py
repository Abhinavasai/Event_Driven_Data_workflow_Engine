from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import RequireAdmin
from app.auth.models import ApiKey
from app.auth.schemas import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse, ApiKeyUpdate
from app.auth.service import create_api_key, delete_api_key, list_api_keys, update_api_key, validate_api_key
from app.database.postgres import get_db
from app.database.redis import get_redis

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyResponse])
async def get_api_keys(_admin: RequireAdmin, db: AsyncSession = Depends(get_db)):
    keys = await list_api_keys(db)
    return keys


@router.post("", response_model=ApiKeyCreateResponse, status_code=201)
async def post_api_key(
    body: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    """Create an API key. Requires admin unless the database has zero keys (bootstrap)."""
    count = await db.scalar(select(func.count()).select_from(ApiKey)) or 0
    if count > 0:
        if not x_api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
        caller = await validate_api_key(db, redis, x_api_key)
        if caller is None or caller.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

    model, raw_key = await create_api_key(db, redis, body)
    return ApiKeyCreateResponse(
        id=model.id,
        name=model.name,
        role=model.role,
        is_active=model.is_active,
        created_at=model.created_at,
        last_used_at=model.last_used_at,
        api_key=raw_key,
    )


@router.patch("/{key_id}", response_model=ApiKeyResponse)
async def patch_api_key(
    key_id: UUID,
    body: ApiKeyUpdate,
    _admin: RequireAdmin,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    updated = await update_api_key(db, redis, key_id, body)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    return updated


@router.delete("/{key_id}", status_code=204)
async def remove_api_key(
    key_id: UUID,
    _admin: RequireAdmin,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    deleted = await delete_api_key(db, redis, key_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
