from fastapi import APIRouter, Request

from app.auth.dependencies import RequireAdmin, RequireOperator
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1/dead-letter", tags=["dead-letter"])


@router.get("")
async def list_dead_letter(_api_key: RequireOperator, request: Request):
    return await workflow_proxy.proxy_get("/internal/dead-letter", params=dict(request.query_params))


@router.get("/{event_id}")
async def get_dead_letter(event_id: str, _api_key: RequireOperator):
    return await workflow_proxy.proxy_get(f"/internal/dead-letter/{event_id}")


@router.post("/{event_id}/replay")
async def replay_dead_letter(event_id: str, _api_key: RequireAdmin):
    return await workflow_proxy.proxy_post(f"/internal/dead-letter/{event_id}/replay")
