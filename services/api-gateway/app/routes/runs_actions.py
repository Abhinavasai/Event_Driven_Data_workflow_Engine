from fastapi import APIRouter

from app.auth.dependencies import RequireOperator
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1/runs", tags=["run-actions"])


@router.post("/{run_id}/retry")
async def retry_run(run_id: str, _api_key: RequireOperator):
    return await workflow_proxy.proxy_post(f"/internal/runs/{run_id}/retry")


@router.post("/{run_id}/cancel")
async def cancel_run(run_id: str, _api_key: RequireOperator):
    return await workflow_proxy.proxy_post(f"/internal/runs/{run_id}/cancel")
