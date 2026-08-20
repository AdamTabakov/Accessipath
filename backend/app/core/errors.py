"""Error types and FastAPI exception handlers.

Mirrors the Express error middleware: zod-style validation errors produce
`{ error, details }`, HttpError produces `{ error }`, and unexpected errors
are logged but never leak internals to clients."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("accessipath")

ERROR_DETAIL_LIMIT = 500


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class ApiValidationError(Exception):
    """Application-level validation failure shaped like a zod error."""

    def __init__(self, details: list[dict]):
        super().__init__("Invalid request.")
        self.details = details


def _zod_style_details(errors: list[dict]) -> list[dict]:
    details: list[dict] = []
    for error in errors:
        loc = error.get("loc") or []
        path_parts = [str(part) for part in loc if part not in ("body", "query", "path", "header", "cookie")]
        path = ".".join(path_parts) if path_parts else "value"
        details.append({"path": path, "message": error.get("msg", "Invalid value.")})
    return details[:ERROR_DETAIL_LIMIT]


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def _starlette_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        message = "Not found." if exc.status_code == 404 else exc.detail
        return JSONResponse(status_code=exc.status_code, content={"error": message})

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Invalid request.",
                "details": _zod_style_details(exc.errors()),
            },
        )

    @app.exception_handler(HttpError)
    async def _http_error(request: Request, exc: HttpError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"error": exc.message})

    @app.exception_handler(ApiValidationError)
    async def _api_validation(request: Request, exc: ApiValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid request.", "details": exc.details},
        )

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.error("[error] %s", exc, exc_info=True)
        return JSONResponse(status_code=500, content={"error": "An unexpected error occurred."})