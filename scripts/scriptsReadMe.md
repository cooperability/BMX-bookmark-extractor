# Project Scripts

This directory contains helper scripts for managing the Dockerized development environment.

*   `dc_up`: Builds Docker images (if they don\'t exist or if Dockerfiles change) and starts all services defined in `docker-compose.yml` in detached mode. It also removes orphaned containers.
*   `dc_d`: A shortcut for `docker compose down`. Stops and removes containers, networks, and volumes defined in `docker-compose.yml`.
*   `dc_build`: Builds or rebuilds the Docker images for all services defined in `docker-compose.yml`.
*   `dc_build_log`: Builds all services and saves the detailed build output to `build.log` in the project root. Uses BuildKit with plain progress for cleaner logs.
*   `dc_lint`: Runs linters for both the backend (Python: Black, Ruff, isort) and the frontend (TypeScript/JS: ESLint) inside their respective Docker containers.
*   `dc_exec`: Executes an arbitrary command inside a specified service container (defaults to `backend` service, running as `appuser`).
    *   Usage: `./scripts/dc_exec [user@service] <command_and_args>`
    *   Example: `./scripts/dc_exec poetry run pytest -k test_specific`
    *   Example: `./scripts/dc_exec node@frontend npm run test`
*   `dc_poetry`: A shortcut to run Poetry commands specifically within the `backend` container as `appuser`.
    *   Usage: `./scripts/dc_poetry <poetry_command_and_args>`
    *   Example: `./scripts/dc_poetry add httpx`
*   `dc_lock`: A utility script, likely to run `poetry lock --no-update` within the backend container via `dc_poetry` to synchronize the `poetry.lock` file without upgrading dependencies. (Verify script content for exact behavior).
*   `dcs_recs`: "Docker Compose Stop, Remove Containers, Remove Images, Remove Volumes". Stops all services, removes their containers, **forcibly removes the images** used by the services, and removes named volumes. This is a "clean slate" script. Use with caution as it removes images.
*   `dcs_qv`: "Docker Compose Stop, Remove Volumes". Stops all services and removes any named volumes associated with them.

Ensure these scripts are executable (e.g., `chmod +x scripts/*`). They are designed to be run from the project root directory.

Note: If cloning this repository on a Linux or macOS system after it was developed on Windows, you might need to explicitly run `chmod +x scripts/*` to ensure the scripts have the necessary execute permissions.
