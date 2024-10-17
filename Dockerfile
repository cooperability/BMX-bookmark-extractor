# Use Python Alpine as the base image for the main application
FROM python:3.11-slim-bullseye

# Set environment variables
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
RUN useradd -m appuser
WORKDIR /app
USER appuser

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Copy project files
COPY --chown=appuser:appuser pyproject.toml poetry.lock* ./

# Install Python dependencies
RUN poetry install --no-root --no-ansi

# Install spaCy model
RUN poetry run python -m spacy download en_core_web_sm

# Copy the rest of the application
COPY --chown=appuser:appuser ./app ./app

# Expose the port the app runs on
EXPOSE 8000

# Set up healthcheck
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

# Run both the Rust backend and the Python FastAPI server
CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
