import json
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

from app.auth.dependencies import RequireOperator
from app.config import get_settings
from app.proxy.workflow_proxy import workflow_proxy

router = APIRouter(prefix="/api/v1", tags=["upload"])


@router.post("/upload", status_code=201)
async def upload_file(
    _api_key: RequireOperator,
    file: UploadFile = File(...),
    definition_id: str = Form(...),
    input_config: str | None = Form(default=None),
):
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "upload.bin").name
    stored_name = f"{uuid.uuid4()}_{safe_name}"
    destination = upload_dir / stored_name

    content = await file.read()
    destination.write_bytes(content)

    parsed_config = None
    if input_config:
        parsed_config = json.loads(input_config)

    payload = {
        "filePath": str(destination),
        "definitionId": definition_id,
        "inputConfig": parsed_config,
        "createdBy": _api_key.name,
    }
    response = await workflow_proxy.proxy_post("/internal/ingest", json=payload)
    if response.status_code >= 400:
        return response
    body = json.loads(response.body)
    return {
        "run_id": body.get("id") or body.get("run_id"),
        "file_name": safe_name,
        "status": body.get("status", "PENDING"),
    }
