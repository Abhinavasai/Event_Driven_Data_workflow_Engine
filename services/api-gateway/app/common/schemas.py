from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorResponse(BaseModel):
    detail: str
    code: str | None = None


class SuccessResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T] = Field(default_factory=list)
    page: int = 1
    page_size: int = 20
    total: int = 0


class HealthComponent(BaseModel):
    status: str
    detail: str | None = None


class GatewayHealthResponse(BaseModel):
    status: str
    database: HealthComponent
    redis: HealthComponent
    workflow_engine: HealthComponent
    transform_service: HealthComponent
