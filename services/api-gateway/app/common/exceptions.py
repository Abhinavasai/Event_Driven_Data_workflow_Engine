from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class GatewayException(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str | None = None) -> None:
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class UpstreamUnavailable(GatewayException):
    def __init__(self, message: str = "Upstream service unavailable") -> None:
        super().__init__(message, status_code=502, code="upstream_unavailable")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(GatewayException)
    async def gateway_exception_handler(_request: Request, exc: GatewayException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )
