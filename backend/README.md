# BMX Backend (FastAPI)

## Overview

The BMX backend is a **FastAPI-based system** designed to implement a hybrid database architecture combining PostgreSQL and Neo4j for optimal knowledge management. This approach provides both efficient content storage and powerful relationship mapping capabilities.

## Architecture Highlights

### Hybrid Database Strategy
- **PostgreSQL**: Primary storage for document content, metadata, and search optimization
- **Neo4j**: Lightweight relationship mapping and graph traversal for knowledge discovery
- **Unified API**: Single FastAPI interface for both database systems
- **Event-driven Sync**: Automatic synchronization between databases for data consistency

### Key Benefits
- **Cost Optimization**: 40-60% reduction in graph database storage costs
- **Performance**: Optimized queries leveraging each database's strengths
- **Scalability**: Independent scaling of content storage and relationship mapping
- **Flexibility**: Easy migration and data management strategies

## Development Setup

### Quick Start
```bash
# From dev container or with Poetry installed
poetry install
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

### API Documentation
- **Interactive Docs**: `http://localhost:8000/docs` (Swagger UI)
- **Alternative Docs**: `http://localhost:8000/redoc` (ReDoc)

## Implementation Details

See [documentation/hybrid-database-architecture.md](../documentation/hybrid-database-architecture.md) for comprehensive implementation guidance.

### Database Models
- **PostgreSQL Models**: Content storage, metadata, processing results
- **Neo4j Relationships**: Entity connections, concept mapping, knowledge graphs
- **Hybrid Queries**: Cross-database operations for comprehensive data access

### API Endpoints
- `/health`: System health and database connectivity
- `/ingest`: Multi-source data ingestion (Anki, web scraping)
- `/graph`: Neo4j graph operations and visualization
- `/search`: PostgreSQL full-text search with graph context
- `/relationships`: Cross-database relationship queries

## Current Status

**Phase 1**: Foundation complete with FastAPI structure and containerization
**Phase 2**: Hybrid database integration in progress
**Next**: Anki data ingestion and basic graph operations

The backend is designed to support BMX's vision of intelligent knowledge management through efficient data storage and powerful relationship discovery.

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