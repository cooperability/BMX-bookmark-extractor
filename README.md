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
1.  Ensure `poetry.lock` is consistent with `pyproject.toml` (run `./scripts/dc_poetry lock --no-update` or `./scripts/dc_poetry install` if needed).
2.  Start the development environment:
    ```bash
    docker-compose up backend neo4j --build # Add postgres if configured
    ```

3.  Access the services:
    *   Backend API: `http://localhost:8000`
    *   API Docs: `http://localhost:8000/docs` or `/redoc`
    *   Neo4j Browser: `http://localhost:7474` (Connect with `bolt://localhost:7687`, user `neo4j`, password from your `.env` or `docker-compose.yml`)

4.  Run commands (like tests or dependency installs) inside the container:
    ```bash
    # Example: Run pytest
    docker-compose exec backend poetry run pytest

    # Example: Add a dependency
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