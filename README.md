# BMX-bookmark-extractor

![](https://github.com/cooperability/BMX-bookmark-extractor/blob/main/Screen%20Recording%202023-09-18%20at%201.07.22%20PM.gif)

## Core Mission

BMX (BookMark eXtractor) aims to be a "secondary brain," synthesizing complex, multi-disciplinary information from diverse sources (Anki exports, web links) into structured, interconnected knowledge bases (Neo4j and PostgreSQL). It employs a multi-stage pipeline (scraping, NLP, LLM) to condense information into "ultra-distilled documents," enabling advanced querying and insight generation.

**Key Use Case:** Users provide lists of web links. BMX processes these, condenses their content, and integrates them into a knowledge graph. Users can then query this unified knowledge base for synthesized answers.

## Stack

*   **Backend Framework**: FastAPI (Python) - `backend/src`
*   **Graph Database**: Neo4j (Docker)
*   **Relational Database**: PostgreSQL (Docker, for metadata and processed items)
*   **Database Clients**: `neo4j` (Python driver), SQLAlchemy
*   **Data Validation**: Pydantic
*   **Containerization**: Docker & Docker Compose
*   **Dependency Management**: Poetry (backend), npm (frontend)
*   **Testing**: Pytest (backend)
*   **(Future) LLM Integration**: Google Gemini API

## Development Environment Setup

**Prerequisites:**
*   Docker and Docker Compose
*   Git

**Initial Setup:**
1.  Clone the repository: `git clone https://github.com/cooperability/BMX-bookmark-extractor.git && cd BMX-bookmark-extractor`
2.  Create `.env` from `.env.example`: Copy `.env.example` (from the project root) to `.env` (in the project root) and fill in your Neo4j, PostgreSQL (when added), and Gemini API key details.
    *   **Important:** Add `.env` to your `.gitignore` file.
3.  Build and start services:
    ```bash
    ./scripts/dc_up --build
    ```
    *   For subsequent starts: `./scripts/dc_up`

**Accessing Services:**
*   Backend API: `http://localhost:8000`
*   API Docs: `http://localhost:8000/docs` or `/redoc`
*   Neo4j Browser: `http://localhost:7474` (connect to `bolt://localhost:7687`)
*   Frontend: `http://localhost:3000`

## Key Development Workflow & Commands

This project uses a containerized workflow. All development tools and dependencies are managed and run inside Docker containers.

**Helper Scripts (`./scripts/` directory):**
*   `./scripts/dc_up`: Builds (if needed) and starts all services defined in `docker-compose.yml`.
*   `./scripts/dc_poetry <command>`: Executes Poetry commands within the `backend` container (e.g., `./scripts/dc_poetry add <package>`, `./scripts/dc_poetry install`).
*   `./scripts/dc_lint`: Runs linters for both backend (Black, Ruff, isort) and frontend (ESLint) inside their respective containers.
*   `./scripts/dc_exec <command>`: Executes an arbitrary command inside the `backend` container (e.g., for tests: `./scripts/dc_exec poetry run pytest`).

**Pre-commit Hooks:**
*   Linters and formatters are automatically run on staged files before each commit. Configuration is in `.pre-commit-config.yaml`. The hook script itself is in `.git/hooks/pre-commit`.

## Project Structure & Key Configurations

*   `backend/`: FastAPI application.
    *   `Dockerfile`: Defines the backend service image.
        *   Note: `pre-commit` is installed via `pip` as a workaround for reliable git hook execution. The `chown` command at the end can be slow on Docker Desktop (Windows/macOS) due to filesystem issues.
    *   `pyproject.toml`: Backend Python dependencies managed by Poetry.
*   `frontend/`: Next.js application.
    *   `Dockerfile`: Defines the frontend service image.
    *   `.dockerignore`: Crucial for keeping the build context small and build times fast.
*   `docker-compose.yml`: Orchestrates all services (backend, frontend, Neo4j, etc.).
    *   Note: The project root (`.`) is mounted to `/project` in the backend container to allow `pre-commit` to access the `.git` directory. The frontend service uses an anonymous volume for `/app/node_modules` to prevent host mount overwriting.
*   `.env.example`: Template for necessary environment variables (copy to `.env` for local configuration).
*   `.pre-commit-config.yaml`: Defines pre-commit checks for code quality.

## Troubleshooting & Key Learnings

*   **Git "Dubious Ownership" (Pre-commit/Backend Container):** If `pre-commit` fails due to "dubious ownership" of the `/project` directory inside the backend container, the hook script (`.git/hooks/pre-commit`) attempts to resolve this by adding `/project` to Git's `safe.directory` configuration *within the container*.
*   **Slow `chown` in Backend Docker Build:** This is a known issue with Docker Desktop on Windows/macOS due to filesystem sharing overhead. For significantly faster builds, consider using WSL2 or a Linux environment for Docker.
*   **Frontend Build Times:** Ensure `frontend/.dockerignore` is comprehensive. If build times are still slow, check the size of the assets being copied into the image.

## Implementation Plan (Revised May 2025 - Focus on Knowledge Pipeline)

*   **Phase 1: Neo4j Setup & Initial Anki Ingestion (Weeks 1-3)**
    *   Focus: Establish Neo4j, define data model for Anki, implement parser and ingestion scripts, basic FastAPI for Neo4j.
*   **Phase 2: PostgreSQL Integration & Metadata Management (Weeks 4-5)**
    *   Focus: Add PostgreSQL for metadata, link Neo4j nodes to Postgres records.
*   **Phase 3: Web Content Ingestion Pipeline - Foundation (Weeks 6-8)**
    *   Focus: Develop web scraping, initial non-LLM condensation (SpaCy/NLTK), store in PostgreSQL.
*   **Phase 4: LLM-Enhanced Condensation & Neo4j Integration for Web Content (Weeks 9-12)**
    *   Focus: Integrate Gemini API for refining content, map to Neo4j graph.
*   **Phase 5: Advanced Querying, API Expansion & LLM Interaction (Weeks 13-16+)**
    *   Focus: Enable sophisticated querying using LLM with context from Neo4j/PostgreSQL.
*   **Phase 6: Deployment, Scalability & Refinement (Ongoing)**
    *   Focus: Production readiness, scaling, monitoring.

## (Future) LLM Integration Principles

*   **LLM Choice**: Google Gemini API.
*   **Output Priorities**:
    1.  **Factual**: Accurate to source.
    2.  **Verifiable**: Traceable to sources.
    3.  **Holistic**: Leverages graph connections.
    4.  **Concise**: Effectively summarized.
