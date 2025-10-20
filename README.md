# BMX (BookMark eXtractor)

A sophisticated knowledge management system designed to transform bookmark collections into actionable knowledge through AI-powered analysis and graph-based exploration.

## Quick Start (Local Development)

### Prerequisites
- **Docker Desktop** - Must be running before starting development
- **Git** - Version control
- **VS Code** (recommended) - With Dev Containers extension for seamless development
- **WSL2** (Windows only) - For optimal Docker performance

### Setup Methods

#### Method 1: DevContainer (Recommended for VS Code Users)
```bash
git clone <repository-url>
cd BMX-bookmark-extractor

# Ensure Docker Desktop is running first!
docker ps  # Should not return ENOENT error

# Open in VS Code
code .

# Reopen in container when prompted
# Or manually: F1 → "Dev Containers: Reopen in Container"
```

The dev container will automatically:
- Set up Python environment with Poetry
- Configure SvelteKit frontend with all dependencies
- Initialize Neo4j database
- Install development tools and extensions

**From integrated terminal (inside container):**
```bash
# Backend (FastAPI)
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
# Or: ./scripts-devcontainer/dev

# Frontend (SvelteKit)
cd /project/frontend && yarn dev
```

#### Method 2: Docker Compose (Works with Any Editor)
```bash
git clone <repository-url>
cd BMX-bookmark-extractor

# Start all services
./scripts/dc_up

# Backend (separate terminal)
./scripts/dc_exec backend poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (separate terminal)
./scripts/dc_exec frontend yarn dev
```

### Troubleshooting
**"Docker is not running" error?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for complete solutions.

**Quick fixes:**
```bash
# 1. Start Docker Desktop (Windows/macOS)
# 2. Verify Docker is running
docker ps

# 3. Clean WSL2 cache (Windows, if corrupted)
rm -rf ~/.vscode-server ~/.cursor-server

# 4. Clear Docker cache
docker system prune -af
```

## System Architecture

BMX uses a **hybrid database architecture** combining:
- **PostgreSQL** for efficient full-text content storage and complex queries
- **Neo4j** for relationship mapping and graph-based knowledge exploration
- **FastAPI** backend for robust API and data processing
- **SvelteKit** frontend for modern, responsive user interface

### Key Features

*   **Multi-Source Ingestion**: Process bookmarks from browser exports, Anki flashcards, and direct web scraping
*   **AI-Powered Analysis**: Use Google Gemini API for intelligent content summarization and entity extraction
*   **Graph-Based Knowledge Discovery**: Visualize and explore relationships between concepts, documents, and ideas
*   **Hybrid Storage Strategy**: Optimize for both performance and cost with intelligent data distribution
*   **Real-Time Processing**: Stream-based ingestion and processing for immediate insights

## Documentation

*   **System Architecture**: [documentation/system-architecture-flow.md](documentation/system-architecture-flow.md) - Complete system diagrams and data flow visualization
*   **Database Design**: [Hybrid Database Architecture](documentation/hybrid-database-architecture.md) - Detailed PostgreSQL + Neo4j implementation strategy
*   **AI Integration**: [LLM Integration Guide](documentation/llm-integration.md) - Google Gemini API setup and usage patterns
*   **Development**: [Implementation Plan](documentation/implementation-plan.md) - Phased development roadmap and current status
*   **Planning**: [documentation/](documentation/) - Implementation plans, MVP specs, and design documents

## Project Status

**Current Phase**: Early development with foundational architecture established
**Next Milestone**: Neo4j integration and hybrid storage implementation
**Target**: Production-ready MVP with Anki data ingestion and basic graph visualization

BMX represents a comprehensive approach to knowledge management, transforming scattered bookmarks and information into a cohesive, explorable knowledge graph that helps users discover connections and insights they never knew existed.

## License

[License details in LICENSE file](LICENSE)
