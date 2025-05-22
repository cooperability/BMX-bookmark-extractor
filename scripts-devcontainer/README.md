# Dev Container Scripts

This directory contains helper scripts for development **within** the dev container environment.

## Key Differences from `/scripts`

- **`/scripts`**: Designed to be run from your **host machine** to manage Docker Compose services
- **`/scripts-devcontainer`**: Designed to be run **inside** the dev container

## When to Use Which

### Use `/scripts` (from host) when:
- Starting/stopping the entire development environment
- Building Docker images
- Managing Docker Compose services
- You're working outside the dev container

### Use `/scripts-devcontainer` (from inside dev container) when:
- You're working inside the dev container
- Running application-specific commands
- Running tests, linting, or other development tasks
- Managing Python dependencies with Poetry

## Available Scripts

*   **`test`**: Run pytest with any additional arguments (`./scripts-devcontainer/test`, `./scripts-devcontainer/test -k specific_test`)
*   **`lint`**: Run all Python linting tools (Black, isort, Ruff) on the `src/` directory
*   **`dev`**: Start the FastAPI development server with auto-reload on port 8000
*   **`install`**: Install dependencies with Poetry (`./scripts-devcontainer/install` or `./scripts-devcontainer/install --update`)
*   **`shell`**: Activate the Poetry virtual environment shell

## Examples

```bash
# From host machine - start all services
./scripts/dc_up

# From inside dev container - run tests
./scripts-devcontainer/test

# From inside dev container - run linting
./scripts-devcontainer/lint
``` 