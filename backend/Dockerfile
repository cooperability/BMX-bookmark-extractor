# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME="/opt/poetry"
# Ensure .venv is created in /app/.venv
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
# Add poetry to PATH
ENV PATH="$POETRY_HOME/bin:$PATH"
ENV APP_HOME=/app

# Install system dependencies
# - curl: for poetry installation script
# - git: required by pre-commit for certain hooks and by poetry for git dependencies
RUN apt-get update && \
    apt-get install --no-install-recommends -y curl git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry itself
RUN curl -sSL https://install.python-poetry.org | python3 -

# Install pre-commit globally using pip
# This is a workaround for reliable execution with git hooks via `docker compose exec`,
# as running it via `poetry run pre-commit` from the hook script proved problematic.
RUN pip install --no-cache-dir pre-commit==4.2.0

WORKDIR ${APP_HOME}

# Copy project definition files (relative to context ./backend)
COPY pyproject.toml poetry.lock* ./

# Verify/update lock file based on current pyproject.toml within build context
# --no-update ensures that we only sync the lock file if pyproject.toml changed,
# without attempting to upgrade any dependencies.
RUN poetry lock --no-update --no-interaction

# Install ALL dependencies (prod + dev) using Poetry
# This creates the .venv directory inside /app as per POETRY_VIRTUALENVS_IN_PROJECT=true
# --no-root is used because the main package (src) hasn't been copied yet and isn't installable at this stage.
RUN poetry install --no-interaction --no-ansi --no-root

# Copy application code (relative to context ./backend)
COPY src ${APP_HOME}/src

# Create a non-root user and group for security best practices
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Change ownership of the application and poetry directories
# This ensures the appuser can manage dependencies and run the application.
# NOTE: This `chown` command can be slow on Docker Desktop (Windows/macOS)
# due to filesystem sharing overhead. For faster builds, consider Linux/WSL2.
RUN chown -R appuser:appgroup ${APP_HOME} ${POETRY_HOME}

# Switch to the non-root user
USER appuser

# Set poetry cache dir for the appuser, inside the app home directory.
# This should be done *after* chown and USER switch to ensure correct permissions.
ENV POETRY_CACHE_DIR=${APP_HOME}/.cache

# Set up healthcheck
# TODO: Adjust the healthcheck endpoint if /health is not available or needs auth
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1

# Command to run the application using Uvicorn from the venv
CMD ["/app/.venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
