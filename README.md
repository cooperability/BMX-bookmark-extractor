# BMX (BookMark eXtractor)

A sophisticated knowledge management system designed to transform bookmark collections into actionable knowledge through AI-powered analysis and graph-based exploration.

## Quick Start (Local Development)

### Prerequisites
- **Docker & Docker Compose** - For containerized development environment
- **Git** - Version control
- **VS Code** (recommended) - With Dev Containers extension for seamless development

### One-Command Setup
```bash
git clone <repository-url>
cd BMX-bookmark-extractor
# Open in VS Code and reopen in Dev Container when prompted
# Or manually: code . && "Dev Containers: Reopen in Container"
```

The dev container will automatically:
- Set up Python environment with Poetry
- Configure SvelteKit frontend with all dependencies
- Initialize Neo4j and PostgreSQL services
- Install development tools and extensions

### Development Commands
```bash
# Backend (FastAPI) - from dev container terminal
poetry run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (SvelteKit) - from host or container
cd frontend && npm run dev
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
