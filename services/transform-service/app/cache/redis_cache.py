from __future__ import annotations

import json
from io import BytesIO

import pandas as pd
from redis.asyncio import Redis


class RedisDataFrameCache:
    def __init__(self, redis: Redis, ttl_seconds: int = 3600, use_parquet: bool = True) -> None:
        self.redis = redis
        self.ttl_seconds = ttl_seconds
        self.use_parquet = use_parquet

    def cache_key_for_run(self, run_id: str) -> str:
        return f"transform:cache:{run_id}"

    async def cache_dataframe(self, run_id: str, df: pd.DataFrame) -> tuple[str, int]:
        """Store JSON rows as a STRING so Java StringRedisTemplate can read the same key."""
        key = self.cache_key_for_run(run_id)
        json_rows = df.to_json(orient="records", date_format="iso")
        size_bytes = len(json_rows.encode("utf-8"))
        await self.redis.set(key, json_rows, ex=self.ttl_seconds)
        if self.use_parquet:
            buffer = BytesIO()
            df.to_parquet(buffer, engine="pyarrow", index=False)
            parquet_bytes = buffer.getvalue()
            await self.redis.set(f"{key}:parquet", parquet_bytes, ex=self.ttl_seconds)
            size_bytes = len(parquet_bytes)
        return key, size_bytes

    async def retrieve_dataframe(self, cache_key: str) -> pd.DataFrame:
        parquet_raw = await self.redis.get(f"{cache_key}:parquet")
        if parquet_raw:
            if isinstance(parquet_raw, str):
                parquet_raw = parquet_raw.encode("utf-8")
            return pd.read_parquet(BytesIO(parquet_raw), engine="pyarrow")

        rows_raw = await self.redis.get(cache_key)
        if rows_raw is None:
            # Backward compat: older hash layout
            data = await self.redis.hgetall(cache_key)
            if not data:
                raise KeyError(f"Cache key not found: {cache_key}")
            decoded = {
                (k.decode() if isinstance(k, bytes) else k): v
                for k, v in data.items()
            }
            if "parquet" in decoded:
                raw = decoded["parquet"]
                if isinstance(raw, str):
                    raw = raw.encode("utf-8")
                return pd.read_parquet(BytesIO(raw), engine="pyarrow")
            rows_raw = decoded.get("rows", b"[]")

        if isinstance(rows_raw, bytes):
            rows_raw = rows_raw.decode("utf-8")
        records = json.loads(rows_raw or "[]")
        return pd.DataFrame(records)
