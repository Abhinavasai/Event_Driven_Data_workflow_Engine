from fastapi import APIRouter, Request

from app.auth.dependencies import RequireViewer
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


@router.get("")
async def list_runs(_api_key: RequireViewer, request: Request):
    return await workflow_proxy.proxy_get("/internal/runs", params=dict(request.query_params))


@router.get("/{run_id}")
async def get_run(run_id: str, _api_key: RequireViewer):
    return await workflow_proxy.proxy_get(f"/internal/runs/{run_id}")
