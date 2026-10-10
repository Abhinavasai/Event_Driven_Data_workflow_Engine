from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    redis_url: str = "redis://localhost:6379/0"
    transform_stream: str = "transform:events"
    consumer_group: str = "transform-service-group"
    consumer_name: str = "transform-consumer-1"
    cache_ttl_seconds: int = 3600
    cache_use_parquet: bool = True
    input_dir: str = "/data/input"
    block_ms: int = 5000
    read_count: int = 1


@lru_cache
def get_settings() -> Settings:
    return Settings()
