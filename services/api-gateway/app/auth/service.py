from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import ApiKey
from app.auth.schemas import ApiKeyCreate, ApiKeyUpdate
from app.config import get_settings


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    return secrets.token_urlsafe(48)


async def _cache_api_key(redis: Redis, api_key: ApiKey) -> None:
    settings = get_settings()
    key = f"api_key:{api_key.key_hash}"
    payload = {
        "id": str(api_key.id),
        "name": api_key.name,
        "role": api_key.role,
        "is_active": api_key.is_active,
    }
    await redis.hset(key, mapping=payload)
    await redis.expire(key, settings.api_key_cache_ttl)


async def create_api_key(
    db: AsyncSession, redis: Redis, body: ApiKeyCreate
) -> tuple[ApiKey, str]:
    raw_key = generate_api_key()
    model = ApiKey(
        key_hash=hash_api_key(raw_key),
        name=body.name,
        role=body.role,
        is_active=True,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    await _cache_api_key(redis, model)
    return model, raw_key


async def validate_api_key(db: AsyncSession, redis: Redis, raw_key: str) -> ApiKey | None:
    key_hash = hash_api_key(raw_key)
    cache_key = f"api_key:{key_hash}"
    cached = await redis.hgetall(cache_key)
    if cached:
        if str(cached.get("is_active", "true")).lower() in ("false", "0"):
            return None
        api_key = await db.get(ApiKey, UUID(cached["id"]))
        if api_key and api_key.is_active:
            return api_key
        return None

    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    api_key = result.scalar_one_or_none()
    if api_key is None or not api_key.is_active:
        return None
    await _cache_api_key(redis, api_key)
    return api_key


async def touch_api_key(db: AsyncSession, api_key: ApiKey) -> None:
    api_key.last_used_at = datetime.now(UTC)
    await db.commit()


async def list_api_keys(db: AsyncSession) -> list[ApiKey]:
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    return list(result.scalars().all())


async def update_api_key(
    db: AsyncSession, redis: Redis, key_id: UUID, body: ApiKeyUpdate
) -> ApiKey | None:
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return None
    if body.name is not None:
        api_key.name = body.name
    if body.role is not None:
        api_key.role = body.role
    if body.is_active is not None:
        api_key.is_active = body.is_active
    await db.commit()
    await db.refresh(api_key)
    await _cache_api_key(redis, api_key)
    return api_key


async def delete_api_key(db: AsyncSession, redis: Redis, key_id: UUID) -> bool:
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if api_key is None:
        return False
    await redis.delete(f"api_key:{api_key.key_hash}")
    await db.delete(api_key)
    await db.commit()
    return True
