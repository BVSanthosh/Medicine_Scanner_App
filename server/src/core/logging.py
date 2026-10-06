"""Structured JSON logging and per-request correlation IDs.

Plain-text logs are unsearchable once there is more than one instance running.
JSON lines drop straight into CloudWatch / Loki / Datadog and can be filtered by
request_id, which is what makes a production incident tractable.
"""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from .config import env

# ContextVar rather than a global: each concurrent request gets its own value
# even though they share a thread.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

_RESERVED = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {
    "message",
    "asctime",
    "taskName",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        # Anything passed via logger.info("...", extra={...}).
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value

        return json.dumps(payload, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(env.LOG_LEVEL.upper())

    # Uvicorn installs its own handlers; route them through ours instead.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers = []
        logger.propagate = True

    # The access log is replaced by RequestContextMiddleware below, which
    # records status and duration with the request id attached.
    logging.getLogger("uvicorn.access").disabled = True


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request id, echoes it back, and logs one line per request."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._log = logging.getLogger("api.access")

    async def dispatch(self, request: Request, call_next):
        # Honour an upstream id so a trace survives across services.
        incoming = request.headers.get("X-Request-ID")
        request_id = incoming or uuid.uuid4().hex
        token = request_id_ctx.set(request_id)
        request.state.request_id = request_id

        started = time.perf_counter()
        # The reset must happen only after the access log line is written,
        # otherwise every one of them records request_id "-" and the whole
        # point of the correlation id is lost.
        try:
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = round((time.perf_counter() - started) * 1000, 2)
                self._log.exception(
                    "request failed",
                    extra={
                        "method": request.method,
                        "path": request.url.path,
                        "duration_ms": duration_ms,
                    },
                )
                raise

            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            response.headers["X-Request-ID"] = request_id
            self._log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
            return response
        finally:
            request_id_ctx.reset(token)
