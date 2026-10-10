from typing import Any

from fastapi import APIRouter, Request

from app.auth.dependencies import RequireAdmin, RequireViewer
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


@router.get("")
async def list_workflows(_api_key: RequireViewer, request: Request):
    return await workflow_proxy.proxy_get("/internal/workflows", params=dict(request.query_params))


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, _api_key: RequireViewer):
    return await workflow_proxy.proxy_get(f"/internal/workflows/{workflow_id}")


@router.post("", status_code=201)
async def create_workflow(body: dict[str, Any], _api_key: RequireAdmin):
    return await workflow_proxy.proxy_post("/internal/workflows", json=body)


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, body: dict[str, Any], _api_key: RequireAdmin):
    return await workflow_proxy.proxy_put(f"/internal/workflows/{workflow_id}", json=body)


@router.patch("/{workflow_id}/activate")
async def activate_workflow(workflow_id: str, _api_key: RequireAdmin):
    return await workflow_proxy.proxy_patch(f"/internal/workflows/{workflow_id}/activate")


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, _api_key: RequireAdmin):
    return await workflow_proxy.proxy_delete(f"/internal/workflows/{workflow_id}")
