# BMX (BookMark eXtractor)

A sophisticated knowledge management system designed to transform bookmark collections into actionable knowledge through AI-powered analysis and graph-based exploration.

## Quick Start (Local Development)

### Prerequisites
- **Docker Desktop** - Must be running before starting development
- **Git** - Version control
- **Cursor or VS Code** (recommended) - With Dev Containers extension for seamless development
- **WSL2** (Windows only) - For optimal Docker performance

### Setup Methods

#### Method 1: DevContainer (Recommended for VS Code/Cursor Users)
```bash
git clone <repository-url>
cd BMX-bookmark-extractor

# Quick launch (opens Cursor/VS Code in devcontainer)
./scripts/open_devcontainer

# Or manually:
# 1. Ensure Docker Desktop is running first!
docker ps  # Should not return ENOENT error

# 2. Open in Cursor/VS Code
cursor .  # or: code .

# 3. Reopen in container when prompted
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

**Common Issues:**

| Issue | Solution |
|-------|----------|
| **Docker not running** | Start Docker Desktop, wait for green icon. Verify: `docker ps` |
| **Port conflict (8000/3000)** | `docker compose down` or `netstat -ano \| findstr :8000` to find conflicting process |
| **WSL2 corruption** | `rm -rf ~/.vscode-server ~/.cursor-server` then restart |
| **Neo4j auth failed** | Default credentials: `neo4j` / `bmxpassword` |
| **Build too slow** | Ensure `.dockerignore` exists in `backend/` and `frontend/` |
| **Can't connect to services** | Check logs: `docker compose logs -f <service>` |

**Nuclear Option (Fresh Start):**
```bash
docker compose down -v && docker system prune -af
rm -rf ~/.vscode-server ~/.cursor-server
docker compose up --build
```

## System Architecture

BMX uses a **hybrid database architecture** combining:
- **PostgreSQL** for efficient full-text content storage and complex queries
- **Neo4j** for relationship mapping and graph-based knowledge exploration
- **FastAPI** backend for robust API and data processing
- **SvelteKit** frontend for modern, responsive user interface

### Key Features

- **Multi-Source Ingestion**: Process bookmarks from browser exports, Anki flashcards, and direct web scraping
- **AI-Powered Analysis**: Use Google Gemini API for intelligent content summarization and entity extraction
- **Graph-Based Knowledge Discovery**: Visualize and explore relationships between concepts, documents, and ideas
- **Hybrid Storage Strategy**: Optimize for both performance and cost with intelligent data distribution
- **Real-Time Processing**: Stream-based ingestion and processing for immediate insights
- **Educational Content Integration**: Structured learning materials processed through the knowledge graph for personalized learning paths

## Educational Content Strategy

BMX includes structured educational materials designed for both human learning and LLM knowledge graph integration:

**Features:**
- **Interactive Format**: Jupyter notebooks with executable code examples
- **Structured Metadata**: YAML frontmatter with learning objectives and prerequisites
- **Knowledge Graph Integration**: Content processed through BMX pipeline to extract:
  - Programming concepts and relationships
  - Code-to-concept mappings
  - Progressive learning paths
- **Cross-Domain Connections**: Links educational content with other knowledge domains

**LLM Integration Goals:**
Educational content becomes queryable knowledge, enabling the system to:
- Recommend personalized learning paths
- Explain concepts with executable examples
- Connect theoretical knowledge with practical implementation
- Provide context-aware coding assistance

## Documentation Guide

**Find what you need based on your goal:**

### 🚀 Getting Started
- **[Quick Start](#quick-start-local-development)** - Setup and run BMX locally
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Solve common setup issues
- **[Backend README](backend/README.md)** - FastAPI development guide
- **[Frontend README](frontend/README.md)** - SvelteKit development guide

### 📋 Planning & Development
- **[Implementation Plan](docs/implementation-plan.md)** - Phased development roadmap (Weeks 1-16+)
- **[MVP Specification](docs/mvp-plan.md)** - 1-Day MVP for bookmark knowledge graph
- **[Project Status](#project-status)** - Current phase and next milestones

### 🏗️ Architecture & Design
- **[System Architecture & Data Flow](docs/system-architecture-flow.md)** - Complete system diagrams with Mermaid visualizations
- **[Hybrid Database Architecture](docs/hybrid-database-architecture.md)** - PostgreSQL + Neo4j implementation strategy
- **[Infrastructure Strategy](docs/infrastructure.md)** - Cloud hosting and deployment plans

### 🔌 Integration Guides
- **[Anki Integration](docs/anki-integration.md)** - Flashcard integration with hybrid architecture
- **[LLM Integration](docs/llm-integration.md)** - Google Gemini API setup and patterns
- **[PDF Processing Framework](docs/pdf-processing.md)** - Agentic knowledge ingestion for local PDFs

### 📚 Additional Documentation
- **[Complete Documentation Index](docs/)** - Full documentation directory with all guides and references

### 🔧 Component Documentation
- **[Backend](backend/)** - FastAPI application, Poetry dependencies, Docker configuration
- **[Frontend](frontend/)** - SvelteKit application, npm dependencies, UI components
- **[DevContainer](.devcontainer/)** - Development environment setup and tools
- **[Scripts](scripts/)** - Helper scripts for Docker Compose operations

## Project Status

**Current Phase**: Early development with foundational architecture established  
**Next Milestone**: Neo4j integration and hybrid storage implementation  
**Target**: Production-ready MVP with Anki data ingestion and basic graph visualization

BMX represents a comprehensive approach to knowledge management, transforming scattered bookmarks and information into a cohesive, explorable knowledge graph that helps users discover connections and insights they never knew existed.

## License

[License details in LICENSE file](LICENSE)
