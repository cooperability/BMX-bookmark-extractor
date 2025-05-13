# BMX-bookmark-extractor

![](https://github.com/cooperability/BMX-bookmark-extractor/blob/main/Screen%20Recording%202023-09-18%20at%201.07.22%20PM.gif)
Infrastructure snippets building toward a comprehensive scraping-NLP pipeline for web links, focusing on knowledge structuring and retrieval using Python, Neo4j, and PostgreSQL.

## TODO:
-Frontend linters & auto lint
-

## Project Update & Refocus (May 2025)

Based on a review, the project scope has been significantly refined to focus on achievable goals within a reasonable timeframe. Key decisions include:

*   **Backend Simplification**: The backend will be built using Python with the FastAPI framework, leveraging its performance and ease of use. The previous exploration into Rust has been removed to simplify the tech stack and learning curve.
*   **Streamlined Structure**: The project structure has been cleaned up. All backend code now resides in the `backend/` directory. The previous `app/` directory and the `frontend/` directory (containing a Next.js app) have been removed to focus efforts on the core data pipeline and API.
*   **Data Strategy**: The core data handling strategy involves using both Neo4j (for graph-based relationship modeling) and PostgreSQL (for structured data storage and potential future integrations), ensuring data parity between them.
*   **Dependency Management**: Python dependencies are managed using Poetry at the project root. Commands are run *inside* the Docker container using the `scripts/dc_poetry` helper script (e.g., `./scripts/dc_poetry add <package>`).
*   **LLM Integration**: Google's Gemini API is the recommended choice for future Large Language Model integration due to its capabilities, cost-effectiveness, and ease of integration compared to hosting a local model like LLaMa.
*   **Timeline**: The implementation plan has been adjusted to reflect this focused scope, aiming for core data ingestion and API functionality within approximately 8-12 weeks, with LLM integration as a subsequent phase.

This refocus allows for a clearer path towards building the core value proposition: structuring diverse data sources into robust, queryable knowledge bases.

## Containerized Development Workflow & Troubleshooting Notes

This project relies heavily on a containerized workflow using Docker and Poetry to ensure consistency and avoid local toolchain conflicts. Here are key aspects and troubleshooting insights gathered during setup:

**1. Core Philosophy:**

*   **No Local Installation Required (Beyond Docker):** All Python dependencies (including dev tools like `black`, `ruff`, `isort`, `pytest`, `pre-commit`) are managed and run *inside* the `backend` Docker container.
*   **Poetry for Dependency Management:** `backend/pyproject.toml` and `backend/poetry.lock` define dependencies.
*   **Helper Scripts:** Scripts in `./scripts/` (`dc_poetry`, `dc_lint`, `dc_exec`, `dc_up`) simplify interacting with tools inside the container.

**2. Helper Scripts:**

*   `./scripts/dc_poetry`: Executes `poetry` commands within the running `backend` container (e.g., `./scripts/dc_poetry add <package>`, `./scripts/dc_poetry install`, `./scripts/dc_poetry lock --no-update`). Ensures dependencies are managed in the container's context.
*   `./scripts/dc_lint`: Runs formatters (`black`, `isort`) and linters (`ruff`) against the `/app/src` directory inside the `backend` container.
*   `./scripts/dc_exec`: Executes arbitrary commands inside the `backend` container as the `appuser`.
*   `./scripts/dc_up`: Helper to build and start services with common options like `--remove-orphans`.

**3. Dockerfile & Build Process (`backend/Dockerfile`):**

*   **Single Source of Truth:** The `backend/Dockerfile` is the definitive file for building the backend service image. The `docker-compose.yml` file correctly points to this. Any root-level `Dockerfile` is unused for this service and should be removed.
*   **Single-Stage Build:** The current Dockerfile uses a single stage for simplicity in development.
*   **Tool Installation:** Installs `git` (needed by pre-commit) via `apt-get`. Installs `pre-commit` via `pip` (see Troubleshooting Note below).
*   **Poetry Installation:** Poetry itself is installed using the official script.
*   **Dependency Installation:**
    *   `pyproject.toml` and `poetry.lock` are copied into the `/app` directory.
    *   `RUN poetry lock --no-update --no-interaction` ensures lock file synchronization during build.
    *   `RUN poetry install --no-root` installs dependencies into `/app/.venv`.
*   **User & Permissions:**
    *   An `appuser` is created and used to run the application.
    *   `chown` grants `appuser` ownership of `/app` and `/opt/poetry`.

**4. Volume Mounts & Paths:**

*   `docker-compose.yml` mounts the host project root (`.`) to `/project` inside the container. This allows tools running inside the container to access the `.git` directory and configuration files like `.pre-commit-config.yaml` at runtime.
*   Source code (`backend/src`) is mounted to `/app/src`.
*   The default `WORKDIR` inside the container is `/app`.
*   The Poetry virtual environment is located at `/app/.venv`.

**5. Pre-commit Hook (`.git/hooks/pre-commit`):**

*   **Purpose:** Automatically runs linters/formatters (`black`, `isort`, `ruff`) on staged Python files in `backend/src` before each commit.
*   **Execution:** The hook script on the host uses `docker compose exec` to run commands inside the `backend` container.
*   **Workflow:**
    1.  Sets the Git `safe.directory` configuration for `/project` *locally* within the container to resolve the "dubious ownership" error caused by UID mismatches between host and container.
    2.  Executes `pre-commit run` inside the container.
    3.  Sets `PRE_COMMIT_HOME` to `/tmp/pre-commit-cache` to ensure `pre-commit` has a writable cache directory within the container.
    4.  Runs the checks defined in `.pre-commit-config.yaml`.
    5.  If checks fail or modify files, the commit is aborted.

**6. Troubleshooting & Key Learnings:**

*   **`pyproject.toml` / `poetry.lock` Mismatches:** Solved by running `poetry lock --no-update` during the Docker build (`backend/Dockerfile`).
*   **Missing Dev Dependencies:** Ensure tools are listed under `[tool.poetry.group.dev.dependencies]` in `backend/pyproject.toml`.
*   **`docker compose exec` Path Issues (Git Bash/MINGW):** Resolved by prefixing container paths with `//` when passed as direct arguments (though not needed in the final hook script which uses `sh -c`).
*   **Git "Dubious Ownership" Error:** Caused by the container user (`appuser`) running `git` commands (via `pre-commit`) on the host-mounted `/project` directory. Solved by running `git config -f /project/.git/config --add safe.directory .` inside the container *before* `pre-commit run` executes (handled by the hook script).
*   **`pre-commit` Execution Context Failures:** Initial attempts to run `pre-commit` via `poetry run` or by its absolute path within the virtual env (`/app/.venv/bin/pre-commit`) failed consistently when invoked via the Git hook and `docker compose exec`. The reliable workaround was to install `pre-commit` globally in the container via `pip install` in the `backend/Dockerfile` and call it directly in the hook script. While mixing `pip` and `poetry` isn't ideal, it was necessary for this specific hook integration.
*   **FastAPI Static Files Routing:** Ensure `app.mount(...)` is called *after* defining specific API routes in `main.py`.
*   **Slow `chown` during Build:** Often unavoidable on Docker Desktop (Windows/macOS) due to filesystem sharing overhead.

## Setup

### Prerequisites
*   Docker and Docker Compose installed on your system
*   Git (optional, for cloning the repository)
*   Poetry installed locally (though commands are typically run via Docker script as outlined in "Containerized Development Workflow")

### Steps

1.  Clone the repository (if you haven't already):
    ```bash
    git clone https://github.com/cooperability/BMX-bookmark-extractor.git
    cd BMX-bookmark-extractor
    ```

2.  **Initial Dependency Installation (if needed):**
    *   If `poetry.lock` exists and is up-to-date, you might skip this.
    *   To install dependencies based on `pyproject.toml` and create/update `poetry.lock`:
        ```bash
        # You might need to build the image first if running for the very first time
        docker-compose build backend
        # Run the install command via the helper script
        ./scripts/dc_poetry install
        ```

3.  **Configure Environment Variables:**
    *   Create a `.env` file in the project root directory by copying `.env.example` (you'll need to create `.env.example` first if it doesn't exist).
    *   Add connection details for Neo4j (and PostgreSQL when integrated) to your `.env` file. Example content for `.env.example`:
        ```dotenv
        # Neo4j Connection (adjust if using AuraDB or other managed service)
        NEO4J_URI=bolt://neo4j:7687
        NEO4J_USER=neo4j
        NEO4J_PASSWORD=please_change_password # Match the password in docker-compose.yml

        # PostgreSQL Connection (Example DSN - to be configured in later phase)
        POSTGRES_DSN=postgresql+psycopg2://user:password@postgres:5432/mydatabase
        # ^^^ Adjust user, password, host (service name), and db name as needed

        # Gemini API Key (to be configured in later phase)
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY
        ```
    *   **Important:** Add `.env` to your `.gitignore` file to avoid committing secrets.

4.  **Build and Run Docker Containers:**
    *   For initial development focusing on Neo4j:
        ```bash
        docker-compose up --build backend neo4j
        ```
    *   Once PostgreSQL is added to `docker-compose.yml` and configured:
        ```bash
        docker-compose up --build backend neo4j postgres
        ```

5.  **Access the Application:**
    *   The backend API will be available (e.g., `http://localhost:8000`).
    *   Check the FastAPI documentation endpoint (e.g., `http://localhost:8000/docs` or `/redoc`) for available routes.
    *   Neo4j Browser: `http://localhost:7474` (or your Neo4j Aura instance).

## Core Concept (Updated May 2025)

BMX (BookMark eXtractor) aims to be a "secondary brain," synthesizing complex, multi-disciplinary information from diverse sources into structured, interconnected knowledge bases. It focuses on:
1.  **Ingesting Diverse Data:** Handling structured inputs like Anki exports (`source_data/`) and processing extensive lists of web links provided by users.
2.  **Intelligent Condensation:** Employing a multi-stage pipeline (web scraping, traditional NLP with tools like SpaCy/NLTK, and selective LLM review/enhancement with Gemini) to VASTLY condense information from web sources into "ultra-distilled documents" while retaining core insights and citing sources.
3.  **Knowledge Structuring:** Leveraging Neo4j (potentially a cloud instance like AuraDB for accessibility) to model the intricate relationships within the ingested and condensed knowledge, creating a rich knowledge graph.
4.  **Metadata & Management:** Utilizing PostgreSQL for storing source metadata, citations, processing logs, and potentially user management information, ensuring robust data governance.
5.  **Advanced Retrieval:** Enabling users to query this combined knowledge base using natural language (via LLM integration) and structured queries, providing nuanced, verifiable, and holistically synthesized insights.

*   **Pitch**: BMX transforms diverse information sources—from curated Anki decks to vast collections of web links—into an interconnected knowledge graph (Neo4j) complemented by a structured relational database (PostgreSQL). By applying a sophisticated condensation pipeline and leveraging LLMs like the Gemini API for advanced querying, BMX aims to function as a powerful "secondary brain," enabling users to extract and synthesize deep insights from their information at scale.
*   **Key Use Case**: Users upload lists of web links they want to learn from without manual reading. BMX processes these links, condenses their content into "ultra-distilled" summaries, and integrates them into a knowledge graph alongside existing structured data (like Anki cards). Users can then query this unified knowledge base to get synthesized answers, explore connections, and deepen their understanding.
*   **Output Priorities** (for future LLM querying phase):
    1.  **Factual:** Accurate to the source documents.
    2.  **Verifiable:** Traceable back to original sources/nodes/rows.
    3.  **Holistic:** Leverages connections discovered in the graph database.
    4.  **Concise**: Effectively summarized and synthesized.

## Stack (Simplified & Focused)

*   **Backend Framework**: FastAPI (Python) - Located in `backend/src`.
*   **Graph Database**: Neo4j (running in Docker).
*   **Relational Database**: PostgreSQL (to be added to Docker Compose if used).
*   **ORM/Database Clients**:
    *   `neo4j` (Official Python driver) for Neo4j interactions.
    *   SQLAlchemy (Python ORM) for PostgreSQL interactions.
*   **Data Validation**: Pydantic (integrates seamlessly with FastAPI).
*   **Containerization**: Docker & Docker Compose.
*   **Dependency Management**: Poetry (managed via `./scripts/dc_poetry`).
*   **Testing**: Pytest (tests located in `backend/tests`).
*   **(Future) LLM Integration**: Google Gemini API.
*   **(Optional) Vector Database**: Pinecone or alternatives (Milvus, Qdrant) *if* dense vector similarity search becomes a requirement later.

## Implementation Plan (Revised May 2025 - Focus on Knowledge Pipeline)

This plan prioritizes building the core knowledge ingestion and structuring capabilities, starting with existing Anki data and Neo4j, then expanding to web content and PostgreSQL.

*   **Phase 1: Neo4j Setup & Initial Anki Ingestion (Weeks 1-3)**
    *   **Focus:** Establish the Neo4j graph database as the primary knowledge store.
    *   Set up Neo4j (local Docker instance for dev, consider AuraDB for future deployment).
    *   Define an initial Neo4j data model (nodes like `Card`, `Concept`, `Source`; relationships like `RELATED_TO`, `HAS_SOURCE`, `MENTIONS_CONCEPT`) based on the structure of Anki `.txt` exports in `source_data/`.
    *   Develop a Python parser within `backend/src/ingestion/` for the Anki `.txt` format.
    *   Implement initial data ingestion scripts to populate Neo4j from parsed Anki data.
    *   Set up basic FastAPI (`backend/src/main.py`) with connection logic to Neo4j.
    *   Create initial API endpoints (e.g., `/cards/{id}`, `/concepts/{name}`) to retrieve data from Neo4j.
    *   Establish basic testing for parsing and Neo4j interaction.
    *   Refine `.env.example` for Neo4j and ensure `.gitignore` is correct.

*   **Phase 2: PostgreSQL Integration & Metadata Management (Weeks 4-5)**
    *   **Focus:** Introduce PostgreSQL for managing metadata, sources, and operational data.
    *   Add PostgreSQL service to `docker-compose.yml` and configure connection in FastAPI.
    *   Define PostgreSQL schema using SQLAlchemy (models in `backend/src/models/`) for:
        *   `Sources` (e.g., Anki file name, URL of scraped page).
        *   `ProcessedItems` (linking to Neo4j nodes, storing condensed text, processing status, timestamps).
        *   `Citations` (if applicable).
    *   Modify Anki ingestion to also populate PostgreSQL with source/metadata.
    *   Implement logic to ensure basic linkage or referencing between Neo4j nodes and PostgreSQL records (e.g., Neo4j node has a `source_id` property referring to a Postgres record).
    *   Develop API endpoints for managing/querying source metadata from PostgreSQL.

*   **Phase 3: Web Content Ingestion Pipeline - Foundation (Weeks 6-8)**
    *   **Focus:** Build the initial stages of the web link processing pipeline.
    *   Develop a robust web scraping module (e.g., using `httpx` and `BeautifulSoup`) within `backend/src/ingestion/scraping/` to fetch and clean HTML content from URLs.
    *   Implement PDF text extraction (e.g., `PyPDF2` or `pdfplumber`) if PDF sources are anticipated.
    *   Design the "ultra-distilled document" schema/structure (e.g., key topics, summary, entities, source URL).
    *   Implement initial (non-LLM) condensation techniques using SpaCy/NLTK (e.g., summarization, keyword/entity extraction) in `backend/src/ingestion/nlp/`.
    *   Store raw scraped content and the initially condensed versions in PostgreSQL, linked to their source URL.
    *   Create API endpoints for users to submit a list of links for processing.
    *   Consider a basic task queue (e.g., FastAPI's `BackgroundTasks` for simplicity, or explore Celery for more robust needs later) for asynchronous processing of submitted links.

*   **Phase 4: LLM-Enhanced Condensation & Neo4j Integration for Web Content (Weeks 9-12)**
    *   **Focus:** Integrate LLM for refining condensed web content and populating Neo4j.
    *   Integrate the Google Gemini API client into `backend/src/services/llm_service.py`.
    *   Develop logic to take the initially condensed text (from Phase 3) and further refine/structure it using Gemini API (e.g., generate a more nuanced summary, identify key arguments, extract structured data for Neo4j).
    *   Implement logic to map the LLM-refined "ultra-distilled documents" into the Neo4j graph model (creating/connecting `Concept`, `Source`, and potentially new `WebArticle` nodes).
    *   Ensure processed web content in Neo4j is linked to its corresponding metadata in PostgreSQL.
    *   Refine API for link submission to include status tracking of the multi-stage processing.
    *   Implement more comprehensive testing, error handling, and logging for the entire pipeline.

*   **Phase 5: Advanced Querying, API Expansion & LLM Interaction (Weeks 13-16+)**
    *   **Focus:** Enable sophisticated querying of the integrated knowledge base.
    *   Develop API endpoints for querying Neo4j for complex relationships and paths.
    *   Implement services that:
        1.  Take a user query (natural language).
        2.  Retrieve relevant context from Neo4j (graph patterns) and PostgreSQL (metadata, distilled text).
        3.  Format this context effectively for the Gemini API.
        4.  Process the Gemini API's response to provide a synthesized answer, citing sources.
    *   Build API endpoints for this LLM-powered querying functionality.
    *   Investigate and implement caching strategies for LLM interactions and common queries.

*   **Phase 6: Deployment, Scalability & Refinement (Ongoing)**
    *   **Focus:** Production readiness and continuous improvement.
    *   Prepare Docker configuration for production (e.g., multi-stage builds, security hardening).
    *   Explore scaling the ingestion pipeline (e.g., using a more robust task queue like Celery with multiple workers).
    *   Deploy to a target platform (e.g., DigitalOcean Docker Droplet, or a Kubernetes-based platform if scale demands).
    *   Implement production-grade monitoring, logging, and backup strategies for both databases.
    *   Develop user documentation and refine API based on feedback.

## Database Setup Priority Recommendation

For the BMX project, given your immediate next step of taking Neo4j courses and the nature of your existing `source_data` (structured Anki cards ideal for graph representation), the recommended database setup priority is:

1.  **Neo4j First:**
    *   **Reasoning:**
        *   Aligns with your current learning path and intention to set it up soon.
        *   The Anki card data in `source_data/` is rich with potential connections (topics, tags, inter-card references if any) that are best modeled and explored using a graph database like Neo4j.
        *   Establishing the core knowledge graph with this existing, relatively clean data will allow for early demonstration of BMX's "knowledge connection" capabilities.
        *   It provides a tangible dataset to work with as you learn Neo4j and OGM principles.
    *   **Immediate Actions:** Focus on Phase 1 of the Implementation Plan – setting up Neo4j, defining the initial graph model for Anki cards, and building the ingestion pipeline for this data.

2.  **PostgreSQL Second:**
    *   **Reasoning:**
        *   Once the Neo4j knowledge graph foundation is in place with Anki data, PostgreSQL can be integrated (as in Phase 2) to handle essential metadata, source tracking, citation management, and operational data (like processing logs for the upcoming web ingestion pipeline).
        *   While Django is an option for interacting with PostgreSQL, FastAPI can also work effectively with SQLAlchemy for ORM capabilities, which is already listed in the stack. The choice can be made based on the desired level of admin interface and specific backend management features needed.
    *   **Actions:** After initial Neo4j setup and Anki ingestion, proceed to integrate PostgreSQL to store metadata related to the Anki files and the nodes created in Neo4j. This will set the stage for handling more complex source tracking when web scraping is introduced.

This phased approach allows for iterative development, focusing on leveraging the unique strengths of each database system in alignment with the project's evolving data needs and your learning objectives.

## Coding Form Guidelines

*   Provide context for code changes, specifying WHERE TO ADD/MODIFY CODE/FILES/DEPENDENCIES within the `backend/` directory.
*   Prioritize readability, modifiability, clarity, logic, best practices.
*   Include robust error handling (`try...except` blocks) and log informative errors using Python's `logging` module.
*   Build robust, flexible, and scalable interfaces.
*   Implement comprehensive logging.
*   Format responses in markdown.
*   Specify language identifiers in code blocks.
*   Use type hints extensively in Python code (`backend/`).

## Environment & Setup Notes

1.  **Windows + Git Bash Environment Considerations**
    *   Project runs on Windows using Git Bash.
    *   Docker commands via `docker-compose` should handle path conversions for volumes.
    *   Manage potential line ending issues (`
` vs `
`) using `.gitattributes` or editor settings.
2.  **Docker Dependency Management (Poetry)**
    *   Use the `./scripts/dc_poetry` script to run poetry commands inside the `backend` service container (e.g., `./scripts/dc_poetry add requests`). This ensures dependencies match the container environment.
3.  **Database Passwords/Secrets:**
    *   Use the `.env` file for storing secrets locally.
    *   **DO NOT** commit the `.env` file. Use `.env.example` as a template.
    *   For production, use proper secrets management (Docker secrets, environment variables injected by the platform, etc.).

## Docker Development Setup

### Prerequisites
*   Docker and Docker Compose installed
*   Git (for version control)

### Development Workflow
1.  Ensure `poetry.lock` is consistent with `pyproject.toml` (run `./scripts/dc_poetry lock --no-update` or `./scripts/dc_poetry install` if needed after changing `pyproject.toml`).
2.  Start the development environment:
    ```bash
    # Use the helper script which includes build and removal of orphans
    ./scripts/dc_up --build
    # Or manually:
    # docker-compose up -d backend neo4j --build --remove-orphans # Add postgres if configured
    ```

3.  Access the services:
    *   Backend API: `http://localhost:8000`
    *   API Docs: `http://localhost:8000/docs` or `/redoc`
    *   Neo4j Browser: `http://localhost:7474` (Connect with `bolt://localhost:7687`, user `neo4j`, password from your `.env` or `docker-compose.yml`)

4.  Run commands (like tests, linters, or dependency installs) inside the container using helper scripts or `docker compose exec`:
    ```bash
    # Run linters/formatters
    ./scripts/dc_lint

    # Run pytest
    ./scripts/dc_exec poetry run pytest
    # Or manually: docker-compose exec --user appuser backend poetry run pytest

    # Add a dependency
    ./scripts/dc_poetry add httpx

    # Update backend dependencies
    cd backend
    docker compose exec backend poetry update
    ```

### Production Deployment
For production deployment (e.g., DigitalOcean Docker Droplet):
1.  Ensure a production-ready `docker-compose.prod.yml` or equivalent deployment script exists (e.g., using multi-stage builds, non-root users, specific versions).
2.  Build production images.
3.  Deploy using your chosen platform's tools, ensuring secure secret management.

### Security Considerations
*   Regularly audit dependencies:
    ```bash
    # Run inside the container or using the script
    ./scripts/dc_poetry run safety check # Requires 'safety' package
    docker scan bmx-bookmark-extractor_backend # Use actual image name
    ```
*   Keep base Docker images (`python`, `neo4j`) updated.
*   Use environment variables or secrets for sensitive data; don't commit `.env`.
*   Implement rate limiting, authentication/authorization on API endpoints as needed.

### Troubleshooting
If you encounter issues:
1.  Check volume permissions and paths in `docker-compose.yml`.
2.  Ensure Docker daemon is running.
3.  Review logs:
    ```bash
    docker-compose logs backend
    docker-compose logs neo4j
    ```
4.  Ensure `.env` file exists and has the correct variables/passwords matching `docker-compose.yml`.

## Key CLI Commands

All commands should be run from the project root directory.

*   **Start Services (Backend & Frontend):**
    ```bash
    ./scripts/dc_up --build # Use --build on first run or after Dockerfile changes
    # or just:
    ./scripts/dc_up
    ```
*   **Stop Services:**
    ```bash
    docker compose down
    ```
*   **Run Linters (Backend & Frontend):**
    ```bash
    ./scripts/dc_lint
    ```
*   **Manage Backend Python Dependencies (using Poetry):**
    ```bash
    # Add a package
    ./scripts/dc_poetry add <package_name>

    # Install dependencies from lock file
    ./scripts/dc_poetry install

    # Update dependencies
    ./scripts/dc_poetry update

    # Update the lock file without upgrading dependencies
    ./scripts/dc_poetry lock --no-update
    ```
*   **Run Backend Tests (Pytest):**
    ```bash
    ./scripts/dc_exec poetry run pytest
    # Or manually:
    # docker compose exec --user appuser backend poetry run pytest
    ```
*   **Execute Arbitrary Command in Backend Container:**
    ```bash
    ./scripts/dc_exec <your_command_here>
    # Example:
    # ./scripts/dc_exec ls -l /app
    ```
*   **Execute Arbitrary Command in Frontend Container:**
    ```bash
    docker compose exec frontend <your_command_here>
    # Example:
    # docker compose exec frontend ls -l /app
    ```
*   **View Service Logs:**
    ```bash
    # View logs for all services
    docker compose logs

    # Follow logs for all services
    docker compose logs -f

    # View logs for a specific service
    docker compose logs backend
    docker compose logs frontend
    ```

## Frontend Integration & Troubleshooting Summary (From Chat Session)

This section summarizes key decisions and troubleshooting steps taken during the integration of a Next.js frontend:

*   **Frontend Choice & Setup:** Replaced the initial static `public/index.html` with a minimal Next.js (TypeScript, App Router) application located in the `frontend/` directory. Initialization used `npx create-next-app@latest . --ts --eslint --use-npm --no-tailwind --src-dir --app --import-alias \"@/*\"`.
*   **Containerization:**
    *   A dedicated `frontend/Dockerfile` was created using `node:20-slim`.
    *   A `frontend` service was added to `docker-compose.yml`, exposing port 3000 and mounting `./frontend:/app`. Crucially, an anonymous volume (`/app/node_modules`) was added to prevent the host mount from overwriting container-installed dependencies.
*   **Backend Static File Removal:** The FastAPI backend no longer serves static files. The `public/` directory and the `app.mount(\"/\", StaticFiles(...))` call in `backend/src/main.py` were removed. The backend (`http://localhost:8000`) root path now correctly returns "Not Found", while API routes like `/health` and `/docs` remain functional.
*   **Docker Compose Orchestration:**
    *   **Problem:** Initial attempts to run `./scripts/dc_up` only started the `backend` service.
    *   **Root Cause:** The `scripts/dc_up` script explicitly specified `docker compose up -d backend`, limiting its scope.
    *   **Solution:** Modified `scripts/dc_up` to simply run `docker compose up -d`, allowing it to start *all* services defined in `docker-compose.yml`.
*   **Cross-Origin Resource Sharing (CORS):**
    *   **Problem:** The frontend (`http://localhost:3000`) received a `TypeError: Failed to fetch` when trying to access the backend API (`http://localhost:8000/health`).
    *   **Root Cause:** Browser security policies preventing cross-origin requests.
    *   **Solution:** Implemented CORS in the FastAPI backend (`backend/src/main.py`) using `fastapi.middleware.cors.CORSMiddleware`, specifically allowing requests from the frontend's origin (`http://localhost:3000`).
*   **Unified Linting:**
    *   The `scripts/dc_lint` script was updated to execute linters for *both* the backend (Python: Black, Ruff, isort) and the frontend (TypeScript/JS: ESLint via `npm run lint`) within their respective Docker containers.
    *   The `.pre-commit-config.yaml` file was updated to include a `local` hook. This hook executes `docker compose exec frontend npm run lint` when frontend file types (`.js`, `.jsx`, `.ts`, `.tsx`) are staged, integrating frontend linting into the existing pre-commit workflow alongside backend checks.
