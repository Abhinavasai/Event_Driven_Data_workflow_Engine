from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/workflow"
    redis_url: str = "redis://localhost:6379/0"
    workflow_engine_url: str = "http://localhost:8080"
    transform_service_url: str = "http://localhost:8001"
    api_key_cache_ttl: int = 300
    cors_origins: str = "*"
    upload_dir: str = "/data/input"
    rate_limit_requests: int = 100
    rate_limit_window_seconds: int = 60
    default_admin_api_key: str = ""
    default_admin_name: str = "Default Admin"


@lru_cache
def get_settings() -> Settings:
    return Settings()
