# Use an official Python runtime as a parent image
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV POETRY_VERSION=1.8.2
ENV POETRY_HOME="/opt/poetry"
ENV POETRY_VIRTUALENVS_IN_PROJECT=true

# Install system dependencies required by some Python packages
RUN apt-get update && apt-get install --no-install-recommends -y \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

# Set work directory
WORKDIR /app

# Install project dependencies
COPY pyproject.toml poetry.lock* ./
# --no-root: installs the project itself along with dependencies
# --no-dev: Excludes development dependencies like pytest in the final image
RUN poetry install --no-interaction --no-ansi --no-root --no-dev

# Application stage
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV POETRY_VIRTUALENVS_IN_PROJECT=true
ENV POETRY_HOME="/opt/poetry"

WORKDIR /app

# Copy the project definition files
COPY pyproject.toml poetry.lock* ./

# Copy the installed dependencies AND poetry itself from the builder stage
COPY --from=builder /app/.venv .venv
COPY --from=builder ${POETRY_HOME} ${POETRY_HOME}
COPY ./src /app/src

# Create the non-root user *before* changing ownership
RUN useradd --create-home appuser

# Make sure the appuser owns the copied poetry directory and the app directory
# (Adjust ownership as needed for your application's requirements)
RUN chown -R appuser:appuser ${POETRY_HOME} /app

# Switch to the non-root user
USER appuser

# Add poetry to the PATH for the final stage user as well
ENV PATH="${POETRY_HOME}/bin:${PATH}"

# Command to run the application using Uvicorn
# We point Uvicorn to the 'app' instance within the 'main' module inside the 'src' directory
# --host 0.0.0.0 makes it accessible from outside the container
CMD [".venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"] 