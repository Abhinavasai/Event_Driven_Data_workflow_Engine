from fastapi import APIRouter

from app.metrics_state import metrics

router = APIRouter(tags=["metrics"])


@router.get("/internal/metrics")
async def get_metrics() -> dict:
    return metrics.snapshot()
