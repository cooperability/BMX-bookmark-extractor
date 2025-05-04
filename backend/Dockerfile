# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME="/opt/poetry"
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
# Add poetry to PATH
ENV PATH="$POETRY_HOME/bin:$PATH"
ENV APP_HOME=/app

# Install system dependencies (curl needed for poetry install)
RUN apt-get update && apt-get install --no-install-recommends -y curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry itself
RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR ${APP_HOME}

# Copy project definition files (relative to context ./backend)
COPY pyproject.toml poetry.lock* ./

# Verify/update lock file based on current pyproject.toml within build context
RUN poetry lock --no-update --no-interaction

# Install ALL dependencies (prod + dev) using Poetry
# This creates the .venv directory inside /app
# Add --no-root because src hasn't been copied yet
RUN poetry install --no-interaction --no-ansi --no-root

# Copy application code (relative to context ./backend)
COPY src ${APP_HOME}/src

# Create a non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Change ownership of the application and poetry directories
# Needs to own .venv created by poetry install above
RUN chown -R appuser:appgroup ${APP_HOME} ${POETRY_HOME}

# Switch to the non-root user
USER appuser

# Set cache dir *after* chown and USER switch
ENV POETRY_CACHE_DIR=${APP_HOME}/.cache

# Command to run the application using Uvicorn from the venv
CMD ["/app/.venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"] 