from __future__ import annotations

from typing import Any

import httpx
from fastapi import Response

from app.common.exceptions import UpstreamUnavailable
from app.config import get_settings


class WorkflowProxy:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: httpx.AsyncClient | None = None

    async def startup(self) -> None:
        self._client = httpx.AsyncClient(
            base_url=self.settings.workflow_engine_url,
            timeout=httpx.Timeout(60.0),
        )

    async def shutdown(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("WorkflowProxy not initialized")
        return self._client

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> Response:
        try:
            upstream = await self.client.request(
                method,
                path,
                params=params,
                json=json,
                content=content,
                headers=headers,
            )
        except httpx.HTTPError as exc:
            raise UpstreamUnavailable(str(exc)) from exc
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            media_type=upstream.headers.get("content-type"),
        )

    async def proxy_get(self, path: str, params: dict[str, Any] | None = None) -> Response:
        return await self._request("GET", path, params=params)

    async def proxy_post(
        self,
        path: str,
        json: dict[str, Any] | None = None,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> Response:
        return await self._request("POST", path, json=json, content=content, headers=headers)

    async def proxy_put(self, path: str, json: dict[str, Any] | None = None) -> Response:
        return await self._request("PUT", path, json=json)

    async def proxy_patch(self, path: str, json: dict[str, Any] | None = None) -> Response:
        return await self._request("PATCH", path, json=json)

    async def proxy_delete(self, path: str) -> Response:
        return await self._request("DELETE", path)


workflow_proxy = WorkflowProxy()
