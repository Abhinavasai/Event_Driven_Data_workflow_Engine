from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.auth.dependencies import get_api_key, require_role
from app.auth.models import ApiKey
from app.auth.service import create_api_key, hash_api_key, validate_api_key
from app.auth.schemas import ApiKeyCreate


@pytest.mark.asyncio
async def test_hash_api_key_is_sha256():
    digest = hash_api_key("secret-key")
    assert len(digest) == 64


@pytest.mark.asyncio
async def test_create_api_key_returns_raw_key_once(mock_db, mock_redis):
    mock_db.add = MagicMock()
    body = ApiKeyCreate(name="ci", role="admin")
    with patch("app.auth.service.secrets.token_urlsafe", return_value="raw-test-key"):
        model, raw = await create_api_key(mock_db, mock_redis, body)
    assert raw == "raw-test-key"
    assert model.name == "ci"
    mock_db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_validate_api_key_cache_miss(mock_db, mock_redis, sample_api_key):
    result_mock = AsyncMock()
    result_mock.scalar_one_or_none = MagicMock(return_value=sample_api_key)
    mock_db.execute = AsyncMock(return_value=result_mock)
    key = await validate_api_key(mock_db, mock_redis, "anything")
    assert key == sample_api_key
    mock_redis.hset.assert_awaited()


@pytest.mark.asyncio
async def test_validate_api_key_cache_hit(mock_db, mock_redis, sample_api_key):
    mock_redis.hgetall = AsyncMock(
        return_value={
            "id": str(sample_api_key.id),
            "is_active": "True",
            "role": "admin",
        }
    )
    mock_db.get = AsyncMock(return_value=sample_api_key)
    key = await validate_api_key(mock_db, mock_redis, "anything")
    assert key == sample_api_key


@pytest.mark.asyncio
async def test_get_api_key_missing_header(mock_db, mock_redis):
    with pytest.raises(HTTPException) as exc:
        await get_api_key(None, mock_db, mock_redis)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_role_forbidden():
    dependency = require_role("admin")
    api_key = ApiKey(
        id=uuid4(),
        key_hash="x",
        name="viewer-key",
        role="viewer",
        is_active=True,
    )
    with pytest.raises(HTTPException) as exc:
        await dependency(api_key=api_key)
    assert exc.value.status_code == 403
