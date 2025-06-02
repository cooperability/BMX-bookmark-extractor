# BMX-bookmark-extractor

## Core Mission

BMX (BookMark eXtractor) aims to be a "secondary brain," synthesizing complex, multi-disciplinary information from diverse sources (Anki exports, web links) into structured, interconnected knowledge bases (Neo4j and PostgreSQL). It employs a multi-stage pipeline (scraping, NLP, LLM) to condense information into "ultra-distilled documents," enabling advanced querying and insight generation.

**Key Use Case:** Users provide lists of web links. BMX processes these, condenses their content, and integrates them into a knowledge graph. Users can then query this unified knowledge base for synthesized answers.

## Stack

*   **Backend Framework**: FastAPI (Python) - `backend/src`
*   **Frontend Framework**: SvelteKit (TypeScript/Svelte) - `frontend/src`
*   **Graph Database**: Neo4j (Docker)
*   **Relational Database**: PostgreSQL (Docker, for metadata and processed items)
*   **Database Clients**: `neo4j` (Python driver), SQLAlchemy
*   **Data Validation**: Pydantic
*   **Containerization**: Docker & Docker Compose
*   **Dependency Management**: Poetry (backend), Yarn (frontend)
*   **Testing**: Pytest (backend), Vitest (frontend)
*   **(Future) LLM Integration**: Google Gemini API

## Quick Setup

**Prerequisites:** Docker and Docker Compose

1.  **Clone**: `git clone https://github.com/cooperability/BMX-bookmark-extractor.git && cd BMX-bookmark-extractor`
2.  **Environment**: Copy `.env.example` to `.env` and configure your Neo4j, PostgreSQL, and Gemini API details
3.  **Start**: `./scripts/dc_up --build` (subsequent starts: `./scripts/dc_up`)

**Service URLs:**
*   Backend API: `http://localhost:8000` (docs: `/docs`)
*   Frontend: `http://localhost:3000`
*   Neo4j Browser: `http://localhost:7474`

## Development Workflow

**Helper Scripts (`./scripts/` directory - run from host):**
*   `./scripts/dc_up`: Start all services
*   `./scripts/dc_poetry <command>`: Execute Poetry commands in backend container
*   `./scripts/dc_lint`: Run linters for both backend and frontend
*   `./scripts/dc_exec <service> <command>`: Execute arbitrary commands in containers

**Dev Container Support:**
*   Open project in VS Code with "Dev Containers" extension
*   Automatic environment setup with all tools configured
*   Use `./scripts-devcontainer/` scripts inside the container

## Additional Documentation

*   **System Architecture**: [docs/system-architecture-flow.md](docs/system-architecture-flow.md) - Complete system diagrams and data flow visualization
*   **Frontend**: [frontend/README.md](frontend/README.md) - SvelteKit setup and migration notes
*   **Backend**: [backend/README.md](backend/README.md) - FastAPI structure and development
*   **Dev Containers**: [.devcontainer/README.md](.devcontainer/README.md) - Container configuration and troubleshooting
*   **Planning**: [docs/](docs/) - Implementation plans, MVP specs, and design documents
*   **Scripts**: [scripts-devcontainer/README.md](scripts-devcontainer/README.md) - Container development workflow

## Current Status

BMX is in active development with a working SvelteKit frontend, FastAPI backend foundation, and containerized development environment. The knowledge processing pipeline and graph integration are in development.

## License

[License details in LICENSE file](LICENSE)
