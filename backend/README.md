# BMX Backend (FastAPI)

This directory contains the FastAPI backend service for BMX (BookMark eXtractor).

## Structure

```
backend/
├── src/                 # Main application code
├── tests/              # Test files
├── Dockerfile          # Production container image
├── Dockerfile.base     # Base image with common dependencies
├── startup.sh          # Container startup script
├── pyproject.toml      # Poetry dependencies and config
└── poetry.lock         # Locked dependency versions
```

## Architecture: Hybrid Database Strategy

BMX uses a sophisticated **hybrid PostgreSQL + Neo4j architecture**:

- **PostgreSQL (Supabase)**: Primary storage for large text content, document metadata, summaries
- **Neo4j**: Lightweight relationship mapping, graph traversal, visual exploration
- **Benefits**: Cost optimization, performance optimization, enhanced user experience

**Key Pattern**: Neo4j stores lightweight nodes with PostgreSQL UUIDs as references, enabling fast graph traversal followed by detailed content retrieval.

See [docs/hybrid-database-architecture.md](../docs/hybrid-database-architecture.md) for comprehensive implementation guidance.

## Development

**Key Commands (from project root):**
- `./scripts/dc_poetry <command>` - Execute Poetry commands in container
- `./scripts/dc_exec backend <command>` - Run arbitrary commands in backend container
- `./scripts/dc_exec backend poetry run pytest` - Run tests

**Adding Dependencies:**
```bash
./scripts/dc_poetry add <package>        # Add runtime dependency
./scripts/dc_poetry add --group dev <package>  # Add dev dependency
```

## Configuration Notes

**Poetry & Python Setup:**
- Uses Poetry for dependency management with virtual environment isolation
- Python environment automatically activated in container
- `pyproject.toml` defines all dependencies and project metadata

**Docker Configuration:**
- **Multi-stage build**: `Dockerfile.base` provides shared dependencies, `Dockerfile` adds application code
- **Pre-commit integration**: Installed via pip (not Poetry) for reliable git hook execution within container
- **Permission handling**: Creates `appuser` with specific directory permissions for `.local/share/direnv` and `nltk_data`
- **Volume mounting**: Project root mounted to `/project` to allow pre-commit access to `.git` directory

## Dependency Compatibility

**Critical Version Constraints:**
- `numpy = "^1.24.4"` - Required for SpaCy compatibility
- `spacy = "^3.7.5"` - Pinned to avoid binary incompatibility issues

These constraints prevent import errors that manifest as cryptic module loading failures.

## Troubleshooting

**"Dubious Ownership" Git Errors:**
If pre-commit fails with git ownership errors, the hook script automatically adds `/project` to git's safe directory configuration within the container.

**Slow Docker Builds:**
The `chown` command in the Dockerfile can be slow on Docker Desktop (Windows/macOS) due to filesystem sharing overhead. Consider using WSL2 or native Linux for faster builds.

**Import/Module Errors:**
- Ensure Poetry virtual environment is activated (automatic in container)
- Check dependency version constraints in `pyproject.toml`
- Verify no conflicting system-level packages

## API Documentation

When running, interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc` 