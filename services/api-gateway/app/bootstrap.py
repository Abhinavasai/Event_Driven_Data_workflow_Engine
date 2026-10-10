"""Seed a default admin API key when DEFAULT_ADMIN_API_KEY is set and no keys exist."""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import ApiKey
from app.auth.service import hash_api_key
from app.config import Settings

logger = logging.getLogger(__name__)


async def ensure_default_admin_key(db: AsyncSession, settings: Settings) -> None:
    raw = (settings.default_admin_api_key or "").strip()
    if not raw:
        return

    count = await db.scalar(select(func.count()).select_from(ApiKey))
    if count and count > 0:
        # Ensure the configured key exists even if other keys were created.
        key_hash = hash_api_key(raw)
        existing = await db.scalar(select(ApiKey).where(ApiKey.key_hash == key_hash))
        if existing:
            return
        # Do not auto-insert when other keys already exist and this hash is missing —
        # operators may have rotated away from the default.
        logger.info("Skipping default admin seed; API keys already exist")
        return

    model = ApiKey(
        key_hash=hash_api_key(raw),
        name=settings.default_admin_name,
        role="admin",
        is_active=True,
    )
    db.add(model)
    await db.commit()
    logger.info("Seeded default admin API key '%s'", settings.default_admin_name)
