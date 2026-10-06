"""One error shape for the whole API.

Clients should never have to branch on which layer failed. Every error comes
back as ``{"detail": "...", "requestId": "..."}`` so the mobile app can show
``detail`` directly and a support ticket can quote ``requestId``.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded

from .config import env
from .logging import request_id_ctx 

log = logging.getLogger("api.error")


class AppError(Exception):
    """Domain error carrying the status and the message shown to the user."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _body(detail: str) -> dict[str, str]:
    return {"detail": detail, "requestId": request_id_ctx.get()}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_body(exc.detail))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_body(str(exc.detail)),
            headers=getattr(exc, "headers", None),
        )
        
    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=_body(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Flatten Pydantic's nested errors into one readable sentence. The full
        # structure is logged, not returned - it leaks internal field paths.
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'][1:]) or 'body'}: {err['msg']}"
            for err in exc.errors()
        )
        log.warning("request validation failed", extra={"problems": problems})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body(f"Invalid request. {problems}"),
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Log the traceback; never return it. Stack traces disclose file paths,
        # library versions and sometimes query fragments.
        log.exception("unhandled exception")
        detail = (
            "Something went wrong. Please try again."
            if env.is_production
            else f"{type(exc).__name__}: {exc}"
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_body(detail),
        )
