# Use a multi-stage build
FROM rust:latest AS rust-builder
WORKDIR /usr/src/rust_backend
COPY rust_backend .
RUN cargo build --release

# Use Python 3.12 slim as the base image
FROM python:3.12-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VIRTUALENVS_CREATE=false

# Set work directory
WORKDIR /app

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir poetry

# Copy only requirements to cache them in docker layer
COPY pyproject.toml poetry.lock* /app/

# Project initialization (split into separate steps for better visibility):
RUN poetry lock --no-update
RUN poetry install --no-dev --no-root

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY rust_backend/target/release/bmx_backend /usr/local/bin/bmx_backend
COPY ./app /app/
COPY ./rust_backend /rust_backend/

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

CMD ["sh", "-c", "bmx_backend & uvicorn app.main:app --host 0.0.0.0 --port 8000"]