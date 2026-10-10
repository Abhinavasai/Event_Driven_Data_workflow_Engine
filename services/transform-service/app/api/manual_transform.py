from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.consumer.event_handler import run_manual_transform

router = APIRouter(tags=["manual-transform"])


class ManualTransformRequest(BaseModel):
    run_id: str | None = None
    file_path: str
    file_type: str = "csv"
    transform_config: dict[str, Any] = Field(default_factory=dict)


@router.post("/internal/transform")
async def manual_transform(body: ManualTransformRequest, request: Request) -> dict:
    run_id = body.run_id or str(uuid4())
    try:
        summary = await run_manual_transform(
            request.app.state.redis,
            request.app.state.settings,
            run_id,
            body.file_path,
            body.file_type,
            body.transform_config,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return summary
