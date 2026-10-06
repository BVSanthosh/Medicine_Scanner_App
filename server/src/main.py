from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .core.config import env
from .core.db import engine
from .core.errors import register_exception_handlers
from .core.logging import RequestContextMiddleware, configure_logging
from .rate_limit import limiter
from .routes.auth_route import router as auth_router
from .routes.scan_route import router as scan_router

log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Startup and shutdown.

    The original signature took no arguments; FastAPI calls ``lifespan(app)``,
    so it raised on boot - and it was never passed to ``FastAPI()`` anyway.
    """
    configure_logging()
    log.info("starting", extra={"environment": env.ENVIRONMENT})

    # Fail fast and loudly if the database is unreachable, rather than serving
    # traffic that 500s on the first query.
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        log.info("database connection ok")
    except Exception:
        log.exception("database unreachable at startup")
        if env.is_production:
            raise

    yield

    # Return pooled connections cleanly so Postgres is not left holding them
    # until they time out.
    await engine.dispose()
    log.info("shutdown complete")


app = FastAPI(
    title="SureShot API",
    version="1.0.0",
    lifespan=lifespan,
    # Interactive docs are convenient in development and an information
    # disclosure in production.
    docs_url=None if env.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if env.is_production else "/openapi.json",
)

# --- middleware -------------------------------------------------------
# Order matters: the outermost is listed last. RequestContextMiddleware is added
# last so it wraps everything and every log line carries a request id.

if env.allowed_hosts != ["*"]:
    # Blocks Host header spoofing, which otherwise poisons absolute URLs and
    # some caches.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=env.allowed_hosts)

if env.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=env.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

app.add_middleware(RequestContextMiddleware)


# --- rate limiting ----------------------------------------------------
app.state.limiter = limiter


# --- exception handlers ----------------------------------------------------
register_exception_handlers(app)


# --- routes -----------------------------------------------------------
app.include_router(auth_router)
app.include_router(scan_router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"status": "ok", "service": "sureshot-api"}

@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    """Liveness only: is the process up and serving?

    Deliberately does not touch the database. A liveness probe that fails on a
    slow query gets the container killed during a database blip, turning a
    degradation into an outage.
    """
    return {"status": "healthy"}

@app.get("/health/ready", tags=["ops"])
async def readiness() -> JSONResponse:
    """Readiness: can this instance actually serve traffic?

    This is the one a load balancer should use to decide whether to send
    requests here.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        log.exception("readiness check failed")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "database": "unreachable"},
        )
    return JSONResponse(content={"status": "ready", "database": "ok"})
