from fastapi import APIRouter

from app.auth.dependencies import RequireViewer
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1", tags=["stats"])


@router.get("/stats")
async def get_stats(_api_key: RequireViewer):
    return await workflow_proxy.proxy_get("/internal/stats")
