# BMX Dev Container Configuration

This directory contains VS Code Dev Container configuration for BMX development.

## What You Get

**Pre-configured Environment:**
- Python environment with Poetry and all backend dependencies
- Node.js with Yarn for frontend development
- All VS Code extensions for Python, TypeScript, Docker development
- Automatic port forwarding for all services
- Pre-configured direnv for environment variable management

**No Host Dependencies:**
- No need to install Python, Poetry, Node.js, or Yarn on host machine
- Containerized development environment with full tooling support
- Consistent environment across different development machines

## Configuration

**Memory Requirements:**
- **Minimum**: 6GB RAM + 8GB swap space
- VS Code Server installation is extremely memory-intensive
- Exit code 137 during startup indicates insufficient memory allocation
- Consider closing other applications during container startup

**File Structure:**
```
.devcontainer/
└── devcontainer.json    # Main configuration file
```

## Usage

**Getting Started:**
1. Install "Dev Containers" extension in VS Code
2. Open project folder in VS Code
3. Command Palette → "Dev Containers: Reopen in Container"
4. Container builds automatically (first time takes 5-10 minutes)

**Script Usage Inside Container:**
```bash
# Use container-specific scripts (not host scripts)
./scripts-devcontainer/test      # Run pytest
./scripts-devcontainer/lint     # Run linters
./scripts-devcontainer/dev      # Start FastAPI dev server
./scripts-devcontainer/install  # Install dependencies
```

**Host vs Container Scripts:**
- **Host scripts** (`./scripts/`): Manage Docker Compose services from outside
- **Container scripts** (`./scripts-devcontainer/`): Development tasks inside container

## Troubleshooting

**Memory Issues:**
- Container exits with code 137: Increase Docker memory allocation
- Slow startup: Normal for first-time VS Code Server installation
- Monitor Docker Desktop memory usage during startup

**Permission Errors:**
- Backend Dockerfile creates specific directory permissions for `appuser`
- Critical directories: `.local/share/direnv`, `nltk_data`
- Uses `/bin/bash` shell - changing can cause permission issues

**Import/Module Issues:**
- SpaCy/NumPy require specific version pinning in `backend/pyproject.toml`
- `numpy = "^1.24.4"` and `spacy = "^3.7.5"` prevent binary incompatibility
- Poetry virtual environment automatically activated in container

**Slow File Operations:**
- File system sharing between host and container can be slow on Windows/macOS
- Consider using WSL2 on Windows for better performance
- Large file operations (like `chown` in Docker builds) are particularly affected

## Development Workflow

**Recommended Workflow:**
1. Start other services from host: `./scripts/dc_up` (excludes backend)
2. Open project in VS Code dev container
3. Use container scripts for development tasks
4. Backend runs directly in container with full debugging support
5. All services accessible via forwarded ports

**Port Forwarding:**
- Automatically configured for all project services
- Backend: `localhost:8000` (when running in container)
- Frontend: `localhost:3000` (if running in container)
- Neo4j: `localhost:7474` (from host services)

**Extension Configuration:**
- Python extension pre-configured for Poetry environment
- TypeScript/Svelte extensions for frontend development
- Docker extension for container management
- ESLint, Prettier, Black formatting on save 