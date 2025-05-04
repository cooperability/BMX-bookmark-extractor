# BMX-bookmark-extractor

![](https://github.com/cooperability/BMX-bookmark-extractor/blob/main/Screen%20Recording%202023-09-18%20at%201.07.22%20PM.gif)
Infrastructure snippets building toward a comprehensive scraping-NLP pipeline for web links, focusing on knowledge structuring and retrieval using Python, Neo4j, and PostgreSQL.

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

*   **No Local Installation Required (Beyond Docker):** All Python dependencies (including dev tools like `black`, `ruff`, `isort`, `pytest`) are managed and run *inside* the `backend` Docker container.
*   **Poetry for Dependency Management:** `pyproject.toml` and `poetry.lock` define dependencies.
*   **Helper Scripts:** Scripts in `./scripts/` (`dc_poetry`, `dc_lint`, `dc_exec`, `dc_up`) simplify interacting with tools inside the container.

**2. Helper Scripts:**

*   `./scripts/dc_poetry`: Executes `poetry` commands within the running `backend` container (e.g., `./scripts/dc_poetry add <package>`, `./scripts/dc_poetry install`, `./scripts/dc_poetry lock --no-update`). Ensures dependencies are managed in the container's context.
*   `./scripts/dc_lint`: Runs formatters (`black`, `isort`) and linters (`ruff`) against the `/app/src` directory inside the `backend` container.
*   `./scripts/dc_exec`: Executes arbitrary commands inside the `backend` container as the `appuser`.
*   `./scripts/dc_up`: Helper to build and start services with common options like `--remove-orphans`.

**3. Dockerfile & Build Process (`backend/Dockerfile`):**

*   **Single-Stage Build:** The final Dockerfile uses a single stage for simplicity in this setup.
*   **Poetry Installation:** Poetry itself is installed using the official `install.python-poetry.org` script.
*   **Dependency Installation:**
    *   `pyproject.toml` and `poetry.lock` are copied into the `/app` directory.
    *   Crucially, `RUN poetry lock --no-update --no-interaction` is run *during the build* immediately after copying the files. This ensures the lock file is perfectly synchronized with `pyproject.toml` within the build context, preventing "changed significantly" errors during the subsequent install step.
    *   `RUN poetry install --no-root` installs *all* dependencies (including `dev` group) into `/app/.venv`. The `--no-root` flag is used because the application source (`./src`) is copied later.
*   **User & Permissions:**
    *   An `appuser` is created and used to run the application (improves security).
    *   `chown` is used to grant `appuser` ownership of `/app` (including `.venv`) and `/opt/poetry`. *Note: This `chown` step can be slow on Docker Desktop (Windows/macOS) due to file system sharing overhead.*

**4. Troubleshooting & Key Learnings:**

*   **`pyproject.toml` / `poetry.lock` Mismatches:** If `poetry install` fails during build complaining the lock file is outdated despite running `dc_poetry lock` beforehand, it likely means the build context didn't get the updated lock file correctly. Running `poetry lock --no-update` *inside* the `Dockerfile` (as implemented now) is the most reliable solution. Explicitly copying the lock file out (`docker compose cp`) after locking and before building can also work but is less robust.
*   **Missing Dev Dependencies (`black`, `ruff` not found):** This occurred when dev dependencies were not correctly listed under `[tool.poetry.group.dev.dependencies]` in `pyproject.toml`. Ensure they are added there using `dc_poetry add <package> --group dev` (or manual edit) and then run `dc_poetry lock --no-update` followed by a rebuild.
*   **`docker compose exec` Path Issues (Git Bash/MINGW):** When passing paths (like `/app/src`) to `docker compose exec` from Git Bash/MINGW, the shell might try to translate them into Windows paths (e.g., `C:/Program Files/Git/app/src`), causing errors inside the container. Prefixing the path argument with `//` (e.g., `//${TARGET_DIR}`) in the `exec` command prevents this translation (as done in `scripts/dc_lint`).
*   **`docker compose exec` User Context:** Commands run via `exec` might default to `root`. Use `docker compose exec --user appuser ...` if the command needs to run as the application user (e.g., to use the correct `PATH` for `poetry run`). Helper scripts like `dc_lint` and `dc_exec` already incorporate this.
*   **FastAPI Static Files Routing:** Ensure `app.mount("/", StaticFiles(...))` is called *after* defining specific API routes (`@app.get(...)`) in `main.py` to prevent the static files mount from intercepting API calls.
*   **Slow `chown` during Build:** This is often unavoidable with Docker Desktop's volume mounting on non-Linux systems when dealing with many small files (like in `.venv`). It primarily impacts build time, not runtime.

## Setup

### Prerequisites
*   Docker and Docker Compose installed on your system
*   Git (optional, for cloning the repository)
*   Poetry installed locally (though commands are typically run via Docker script)

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
    *   Add connection details for Neo4j and PostgreSQL to your `.env` file. Example content for `.env.example`:
        ```dotenv
        # Neo4j Connection
        NEO4J_URI=bolt://neo4j:7687
        NEO4J_USER=neo4j
        NEO4J_PASSWORD=please_change_password # Match the password in docker-compose.yml

        # PostgreSQL Connection (Example DSN)
        POSTGRES_DSN=postgresql+psycopg2://user:password@postgres:5432/mydatabase 
        # ^^^ Adjust user, password, host (service name), and db name as needed
        # Add a postgres service to docker-compose.yml if using
        ```
    *   **Important:** Add `.env` to your `.gitignore` file to avoid committing secrets.

4.  **Build and Run Docker Containers:**
    ```bash
    docker-compose up --build backend neo4j # Add postgres if you add the service
    ```

5.  **Access the Application:**
    *   The backend API will be available (e.g., `http://localhost:8000`).
    *   Check the FastAPI documentation endpoint (e.g., `http://localhost:8000/docs` or `/redoc`) for available routes.
    *   Neo4j Browser: `http://localhost:7474`

## Core Concept

BMX (BookMark eXtractor) aims to synthesize complex, multi-disciplinary information from various sources (articles, Anki exports, web scrapes, etc.) into structured knowledge bases. It leverages both graph (Neo4j) and relational (PostgreSQL) databases to provide flexible data modeling and querying capabilities. The ultimate goal is to enable users to query this structured knowledge using advanced AI models.

*   **Pitch**: BMX structures diverse information sources into parallel graph and relational databases. By leveraging these structured representations, potentially combined with LLMs like the Gemini API, BMX aims to provide nuanced insights and synthesized knowledge from user-provided data.
*   **Key Use Case**: Ingesting structured knowledge (like Anki decks) and unstructured data (web scrapes, PDFs), mapping them into Neo4j for relationship analysis and PostgreSQL for structured querying/backups. Later phases will involve using an LLM to query this combined knowledge base for complex questions (e.g., "Synthesize information on topic X from sources Y and Z").
*   **Output Priorities** (for future LLM querying phase):
    1.  **Factual:** Accurate to the source documents stored in the databases.
    2.  **Verifiable:** Traceable back to original sources/nodes/rows.
    3.  **Holistic:** Leverages connections discovered in the graph database.
    4.  **Concise**: Effectively summarized.

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

## Implementation Plan (Revised ~12 Weeks Focus)

*   **Phase 1**: Core Infrastructure & Data Modeling (Weeks 1-2)
    *   Set up Python FastAPI project structure within `backend/`.
    *   Configure Docker Compose for FastAPI (`backend`), Neo4j, and optionally PostgreSQL services.
    *   Define initial database schemas/models using Pydantic/SQLAlchemy and map out Neo4j node/relationship labels.
    *   Implement connection logic for Neo4j (and Postgres if added).
    *   Establish basic API endpoints (`/`, `/health`) and initial tests.
    *   Create `.env.example` and ensure `.gitignore` is correct.
*   **Phase 2**: Data Ingestion Pipeline (Weeks 3-6)
    *   Develop parsers for initial data sources (e.g., Anki `.txt` exports from `source_data/`).
    *   Implement logic to populate *both* Neo4j and PostgreSQL with parsed data, ensuring consistency.
    *   Add basic API endpoints for triggering ingestion and performing simple queries (e.g., get card by ID, get nodes by label).
    *   Implement web scraping (`BeautifulSoup`, `httpx`) and PDF text extraction (`PyPDF2`) services within the `backend/` structure.
    *   Develop basic data validation for ingested content.
*   **Phase 3**: API Expansion & Basic Querying (Weeks 7-8)
    *   Develop more sophisticated API endpoints for querying (e.g., find related concepts via Neo4j paths, retrieve structured records with filters from PostgreSQL).
    *   Implement basic keyword search across stored data.
    *   Refine error handling, logging, and add more comprehensive tests.
*   **Phase 4**: LLM Integration (Gemini API) & Advanced Features (Weeks 9-12+)
    *   Integrate the Google Gemini API client.
    *   Develop a service that takes a query, retrieves relevant context from Neo4j/PostgreSQL, formats it for Gemini, and processes the response.
    *   Build API endpoints for this LLM-powered querying.
    *   Implement testing and basic caching for LLM interactions.
*   **Phase 5**: Deployment & Refinement (Ongoing)
    *   Prepare Docker configuration for production (e.g., multi-stage builds, security hardening).
    *   Deploy to a target platform (e.g., DigitalOcean Docker Droplet).
    *   Implement production monitoring, logging, and backups.
    *   Develop user documentation if applicable.

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