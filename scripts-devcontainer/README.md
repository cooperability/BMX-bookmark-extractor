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

*Coming soon - scripts will be added as needed for dev container workflow*

## Examples

```bash
# From host machine - start all services
./scripts/dc_up

# From inside dev container - run tests
./scripts-devcontainer/test

# From inside dev container - run linting
./scripts-devcontainer/lint
``` 