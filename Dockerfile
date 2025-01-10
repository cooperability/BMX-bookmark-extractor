# Use Python Alpine as the base image for the main application
FROM python:3.11-slim-bullseye AS builder

ENV POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1

RUN apt-get update && apt-get install -y curl && \
    curl -sSL https://install.python-poetry.org | python3 - && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry lock --check

# Main application stage
FROM python:3.11-slim-bullseye

# Set environment variables
#ensure Poetry operates entirely within container context
#prevents attempts to modify host machine's files
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install system dependencies and build tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

# Set up a non-root user for running the application
#Helps resolve permission issues & ensure proper file ownership
#prevents conflicts with host machine's permission restrictions
RUN useradd -m appuser
WORKDIR /app

# Copy poetry files; set permissions
COPY --from=builder /app/poetry.lock ./
COPY pyproject.toml ./
COPY --chown=appuser:appuser ./app ./app

# Change ownership of /app directory to appuser (do this while still root)
RUN chown -R appuser:appuser /app

# Switch to appuser before running poetry install
USER appuser

# Install dependencies and spaCy model in one step
RUN poetry install --no-root --no-ansi && \
    poetry run pip install --no-cache-dir numpy==1.26.4 && \
    poetry run pip install --no-cache-dir spacy==3.7.2 && \
    poetry run python -m spacy download en_core_web_sm

# Expose the port the app runs on
EXPOSE 8000

# Set up healthcheck
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

# Run both the Rust backend and the Python FastAPI server
CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
