# Multi-stage: build tooling and compilers stay out of the runtime image, which
# is both smaller and a smaller attack surface.
FROM python:3.13-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# argon2-cffi and asyncpg need a compiler if no wheel matches.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the requirements first. This layer is then cached across rebuilds
# whenever the dependencies have not changed, which is most of the time.
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt


FROM python:3.13-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Run as a non-root user. A container process that is root is root on the host
# kernel if anything escapes the sandbox.
RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app src ./src

USER app

EXPOSE 8000

# Container-level health so the orchestrator can restart a wedged process.
# Uses the liveness probe, not readiness: a database blip should not kill the app.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# No --reload here. Worker count is left to the orchestrator: one process per
# container scales horizontally and keeps restarts cheap.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
