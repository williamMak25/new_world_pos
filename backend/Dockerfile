# Simple, single-stage image for the POS backend API.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --no-dev --no-install-project

COPY tools ./tools/
COPY src/py ./src/py/

RUN uv sync --no-dev

EXPOSE 8000

CMD ["uv", "run", "app", "run", "--host", "0.0.0.0", "--port", "8000"]
