import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth.models import ApiKey


@pytest.fixture
def sample_api_key() -> ApiKey:
    return ApiKey(
        id=uuid.uuid4(),
        key_hash="abc123",
        name="test-key",
        role="admin",
        is_active=True,
        created_at=datetime.now(UTC),
        last_used_at=None,
    )


@pytest.fixture
def mock_db(sample_api_key):
    db = AsyncMock()
    db.get = AsyncMock(return_value=sample_api_key)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def mock_redis():
    redis = AsyncMock()
    redis.hgetall = AsyncMock(return_value={})
    redis.hset = AsyncMock()
    redis.expire = AsyncMock()
    redis.delete = AsyncMock()
    return redis
