# DevContainer Setup for BMX

This directory configures VS Code DevContainers for seamless development inside Docker.

## Quick Start

### Prerequisites
1. **Docker Desktop** must be running
2. **VS Code** with "Dev Containers" extension installed
3. **WSL2** (Windows) properly configured

### Opening in DevContainer
1. Open this project in VS Code
2. Click "Reopen in Container" when prompted
   - OR: Press `F1` → "Dev Containers: Reopen in Container"
3. Wait for container to build and initialize (first time takes 5-10 minutes)

## What This Does

- **Workspace**: Mounts entire project to `/project` in container
- **Services**: Starts backend, frontend, and Neo4j via Docker Compose
- **Tools**: Installs Python, Node.js, Poetry, Yarn automatically
- **Extensions**: Loads Python, Svelte, Tailwind, Neo4j, and SQL extensions
- **Ports**: Forwards 8000 (FastAPI), 3000 (Svelte), 7474/7687 (Neo4j)

## Development Workflow

### Backend Development
```bash
# From integrated terminal (already in container)
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Or use helper script
./scripts-devcontainer/dev
```

### Frontend Development
```bash
cd /project/frontend
yarn dev
```

### Running Tests
```bash
# Backend tests
./scripts-devcontainer/test

# Frontend tests
cd /project/frontend && yarn test
```

### Database Access
- **Neo4j Browser**: http://localhost:7474
  - Username: `neo4j`
  - Password: `bmxpassword`
- **PostgreSQL**: (When configured) via SQLTools extension

## Troubleshooting

### "Docker is not running"
**Solution**: Start Docker Desktop on your host machine before opening container.

```powershell
# Windows: Check Docker status
docker ps
```

### "Cannot connect to Docker daemon"
**Solution**: Ensure Docker Desktop is fully started (look for green icon in system tray).

### WSL2 "Node not found" errors
**Solution**: Clean WSL2 VS Code server cache:

```bash
# From WSL2 terminal
rm -rf ~/.vscode-server
rm -rf ~/.vscode-remote-containers
rm -rf ~/.cursor-server
rm -rf ~/.cursor
```

Then reopen in container.

### "Port already in use"
**Solution**: Stop any running Docker Compose services:

```bash
# From host terminal
cd c:\Users\coope\Documents\GitHub\BMX-bookmark-extractor
docker compose down
```

Then reopen container.

### Container fails to build
**Solution**: Clear Docker build cache:

```bash
# From host terminal
docker builder prune -af
docker system prune -af
```

Then rebuild: `F1` → "Dev Containers: Rebuild Container"

## Alternative: Docker Compose Workflow (No DevContainer)

If DevContainers cause issues, use traditional Docker Compose:

```bash
# From host terminal (Git Bash on Windows)
cd /c/Users/coope/Documents/GitHub/BMX-bookmark-extractor

# Start all services
./scripts/dc_up

# Execute commands in containers
./scripts/dc_exec backend poetry run uvicorn src.main:app --reload
./scripts/dc_exec frontend yarn dev

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
./scripts/dc_d  # or: docker compose down
```

## Configuration Files

- **`devcontainer.json`**: Main DevContainer configuration
- **`docker-compose.devcontainer.yml`**: DevContainer-specific Docker overrides
- **`../docker-compose.yml`**: Base Docker Compose configuration

## Benefits Over Standard Docker Compose

- Integrated terminal runs **inside** container (no `dc_exec` needed)
- IntelliSense and linting work with container dependencies
- Seamless debugging with breakpoints
- Git operations work with container tools
- Extensions (Python, Svelte) use containerized environments

## When to Use Each Approach

| DevContainer | Docker Compose |
|--------------|----------------|
| Full IDE integration | Simpler setup |
| Best for coding/debugging | Best for service management |
| Requires VS Code | Works with any editor |
| Single container focus | Multi-service orchestration |

Both approaches are supported. Choose what works best for your workflow!
