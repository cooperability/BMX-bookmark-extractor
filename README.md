# BMX-bookmark-extractor

## Core Mission

BMX (BookMark eXtractor) aims to be a "secondary brain," synthesizing complex, multi-disciplinary information from diverse sources (Anki exports, web links) into structured, interconnected knowledge bases (Neo4j and PostgreSQL). It employs a multi-stage pipeline (scraping, NLP, LLM) to condense information into "ultra-distilled documents," enabling advanced querying and insight generation.

**Key Use Case:** Users provide lists of web links. BMX processes these, condenses their content, and integrates them into a knowledge graph. Users can then query this unified knowledge base for synthesized answers.

-Maybe investigate Grafbase for querying GraphQL via MCP?
-Set up dev cointainers and containers extension; "reopen in container" in VScode
-Dev containers resolve import linting and actual autocompletion for modules; plus containerized shell

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

## Development Environment Setup

**Prerequisites:**
*   Docker and Docker Compose
*   Git

**Initial Setup:**
1.  Clone the repository: `git clone https://github.com/cooperability/BMX-bookmark-extractor.git && cd BMX-bookmark-extractor`
2.  Create `.env` from `.env.example`: Copy `.env.example` (from the project root) to `.env` (in the project root) and fill in your Neo4j, PostgreSQL (when added), and Gemini API key details.
    *   **Important:** Add `.env` to your `.gitignore` file.
3.  (Optional) For `direnv` users: Copy `.envrc.example` to `.envrc` and run `direnv allow` to automate your shell environment when navigating into the project directory. This can, for example, automatically add `./scripts` to your `PATH` and load variables from `.env`.
4.  **(Optional) Dev Container Setup**: If using VS Code, you can open the project in a dev container for a fully configured development environment:
    *   Install the "Dev Containers" extension in VS Code
    *   Open the project folder in VS Code
    *   When prompted (or via Command Palette: "Dev Containers: Reopen in Container"), choose to reopen in container
    *   The dev container will build automatically and provide a pre-configured Python environment with all extensions and tools
5.  Build and start services:
    ```bash
    ./scripts/dc_up --build
    ```
    *   For subsequent starts: `./scripts/dc_up`

**Accessing Services:**
*   Backend API: `http://localhost:8000`
*   API Docs: `http://localhost:8000/docs` or `/redoc`
*   Neo4j Browser: `http://localhost:7474` (connect to `bolt://localhost:7687`)
*   Frontend: `http://localhost:3000`

## Dev Container Support

This project includes VS Code Dev Container support for a consistent, fully-configured development environment.

**What you get:**
*   Pre-configured Python environment with Poetry and all extensions
*   Automatic port forwarding and direnv setup
*   No need to install Python, Poetry, or dependencies on your host machine

**Script Organization:**
*   **`./scripts/`**: Run from your **host machine** to manage Docker Compose services (start/stop containers, build images)
*   **`./scripts-devcontainer/`**: Run from **inside the dev container** for development tasks (tests, linting, etc.)

**Workflow:**
1.  Use `./scripts/dc_up` from your host to start other services (Neo4j, etc.)
2.  Open project in VS Code - dev container starts automatically
3.  All development work happens inside the container with full tooling support

## Key Development Workflow & Commands

This project uses a containerized workflow. All development tools and dependencies are managed and run inside Docker containers.

**Helper Scripts (`./scripts/` directory):**
*   `./scripts/dc_up`: Builds (if needed) and starts all services defined in `docker-compose.yml`.
*   `./scripts/dc_poetry <command>`: Executes Poetry commands within the `backend` container (e.g., `./scripts/dc_poetry add <package>`, `./scripts/dc_poetry install`).
*   `./scripts/dc_lint`: Runs linters for both backend (Black, Ruff, isort) and frontend (ESLint, Prettier) inside their respective containers.
*   `./scripts/dc_exec <service_name> <command>`: Executes an arbitrary command inside the specified service container (e.g., for backend tests: `./scripts/dc_exec backend poetry run pytest`; for frontend package install: `./scripts/dc_exec frontend yarn add <package>`).
*   `./scripts/dcps`: Shortcut to run `docker compose ps` to check the status of running services.

**Pre-commit Hooks:**
*   Linters and formatters are automatically run on staged files before each commit. Configuration is in `.pre-commit-config.yaml`. The hook script itself is in `.git/hooks/pre-commit`.

## Project Structure & Key Configurations

*   `backend/`: FastAPI application.
    *   `Dockerfile`: Defines the backend service image.
        *   Note: `pre-commit` is installed via `pip` as a workaround for reliable git hook execution. The `chown` command at the end can be slow on Docker Desktop (Windows/macOS) due to filesystem issues.
    *   `pyproject.toml`: Backend Python dependencies managed by Poetry.
*   `frontend/`: SvelteKit application.
    *   `Dockerfile`: Defines the frontend service image. Uses Node.js with Corepack to manage Yarn for dependency installation and running the development server.
    *   `package.json`: Frontend dependencies managed by Yarn.
    *   `svelte.config.js`, `vite.config.ts`: Configuration for SvelteKit and Vite.
*   `docker-compose.yml`: Orchestrates all services (backend, frontend, Neo4j, etc.).
    *   Note: The project root (`.`) is mounted to `/project` in the backend container to allow `pre-commit` to access the `.git` directory. The frontend service uses an anonymous volume for `/app/node_modules` to prevent host mount overwriting.
*   `.env.example`: Template for necessary environment variables (copy to `.env` for local configuration).
*   `.pre-commit-config.yaml`: Defines pre-commit checks for code quality.

## Educational Content & Knowledge Base Structure

BMX includes a structured educational knowledge base in the `docs/` directory, designed for both human learning and LLM knowledge graph integration.

**Directory Structure:**
```
docs/
├── python-fundamentals/     # Basic Python concepts
├── python-intermediate/     # OOP, decorators, generators
├── python-advanced/         # Metaclasses, async, optimization
└── nlp-course/             # NLP fundamentals and techniques
```

**Key Features:**
*   **Jupyter Notebooks**: Preserved interactive format with executable code examples
*   **Structured Metadata**: YAML frontmatter with topics, prerequisites, learning objectives
*   **Knowledge Graph Integration**: Notebooks processed through BMX pipeline to extract:
    *   Programming concepts and relationships
    *   Code-to-concept mappings
    *   Progressive learning paths
*   **Cross-Domain Connections**: Links educational content with other knowledge domains in the graph

**LLM Integration**: Educational content becomes queryable knowledge, enabling the system to recommend learning paths, explain concepts with executable examples, and connect theoretical knowledge with practical implementation.

## Troubleshooting & Key Learnings

*   **Git "Dubious Ownership" (Pre-commit/Backend Container):** If `pre-commit` fails due to "dubious ownership" of the `/project` directory inside the backend container, the hook script (`.git/hooks/pre-commit`) attempts to resolve this by adding `/project` to Git's `safe.directory` configuration *within the container*.
*   **Slow `chown` in Backend Docker Build:** This is a known issue with Docker Desktop on Windows/macOS due to filesystem sharing overhead. For significantly faster builds, consider using WSL2 or a Linux environment for Docker.
*   **Frontend Build Times:** Ensure `frontend/.dockerignore` is comprehensive. If build times are still slow, check the size of the assets being copied into the image and Docker layer caching.

## Frontend Migration: Next.js to SvelteKit (Key Learnings & Current Status)

This project recently underwent a significant frontend migration from Next.js to SvelteKit. This section captures the current status and key learnings from that process.

**Current Status (as of end of migration):**
*   The Next.js frontend has been completely removed.
*   A basic SvelteKit application has been initialized in the `frontend/` directory.
*   Yarn is now the package manager for the frontend, replacing npm.
*   The `frontend/Dockerfile` has been updated to use Node.js with Corepack to manage Yarn.
*   A health check page (`/health`) has been implemented in SvelteKit. This page successfully:
    *   Fetches data from the FastAPI backend's `/health` endpoint (running in a separate Docker container).
    *   Displays the status and version received from the backend.
*   The Vite dev server for SvelteKit is configured to run on port 3000 and is accessible from the host.

**Key Learnings & Debugging Insights from the Migration:**
*   **Dependency Removal Complexity:** Simply removing a framework package (e.g., `next`) is often insufficient. Integrated libraries and associated tooling (like Paraglide/Inlang for i18n in this case) can leave behind:
    *   Configuration files (e.g., `project.inlang/`, `messages/`).
    *   Plugin registrations in bundler configurations (e.g., `paraglideVitePlugin` in `vite.config.ts`).
    *   Placeholders or import statements in core HTML template files (e.g., `app.html`) or stray script files (e.g., a rogue `hooks.ts`).
*   **Caching Layers:** Docker (build cache, image layers, volume mounts), Vite (dependency pre-bundling, dev server cache), and SvelteKit (`.svelte-kit` directory) all have caching mechanisms. These can be very aggressive and may require explicit and sometimes repeated clearing when debugging persistent "module not found" errors or unexpected behavior after code changes:
    *   Commands like `docker builder prune -af`, `docker system prune -af`, and deleting `node_modules` / `.svelte-kit` were essential.
    *   `docker compose up --build --force-recreate` was frequently used.
*   **Importance of `svelte-kit sync`:** This command generates type definitions and other necessary files (like `.svelte-kit/tsconfig.json`) that are crucial for TypeScript and the SvelteKit language server to function correctly. Ensuring `tsconfig.json` correctly `extends` the SvelteKit-generated one is vital.
*   **Tooling for Discovery:** When facing elusive errors, tools like `grep` (or equivalent text search across the entire project directory) are invaluable for locating unexpected references to removed libraries or configurations.
*   **Iterative Debugging of Dockerized Setups:**
    *   Temporarily changing the `CMD` in a `Dockerfile` (e.g., to `tail -f /dev/null`) allows `exec`-ing into a running container to manually run installation steps (`yarn install`), inspect the filesystem, and generate necessary files (like `yarn.lock`) that can then be copied back to the host or incorporated into the image build process.
    *   Careful examination of Docker build logs and runtime container logs is crucial.
*   **Standardizing Package Managers:** Switching to Yarn involved updating the `frontend/Dockerfile` to use Corepack for Yarn installation and changing all relevant commands in helper scripts and documentation.
*   **Vite Configuration:** Ensuring `vite.config.ts` was cleaned of old plugins and correctly configured for the SvelteKit dev server (e.g., `host: '0.0.0.0'`, `port: 3000`) was important for Docker accessibility.

The migration, while challenging, has resulted in a clean SvelteKit foundation for future frontend development.

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
    *   Consider GraphQL for a flexible user-facing API to query the synthesized knowledge graph.
*   **Phase 6: Deployment, Scalability & Refinement (Ongoing)**
    *   Focus: Production readiness, scaling, monitoring.

## 🚀 1-Day MVP Plan: Bookmark Knowledge Graph (January 2025)

**MISSION:** Create a flashy, functional MVP where users can paste bookmark URLs and view their knowledge corpus as an interactive graph visualization - all computationally light, no LLM needed!

### MVP Architecture Overview
- **Frontend**: Modern SvelteKit interface with drag-and-drop bookmark input + interactive graph visualization
- **Backend**: FastAPI with NLP preprocessing pipeline (SpaCy, NLTK, TF-IDF)
- **Storage**: In-memory Neo4j graph database (no persistence needed for MVP)
- **Visualization**: D3.js/Cytoscape.js for real-time graph rendering
- **Deployment Target**: `remediate.app` (production-ready containerized setup)

### Hour-by-Hour Implementation Schedule

#### **Hours 1-2: Infrastructure Foundation**
- [ ] **Neo4j Setup**: Add Neo4j service to `docker-compose.yml` with in-memory configuration
- [ ] **Backend Dependencies**: Add NLP libraries to `backend/pyproject.toml`:
  - `spacy`, `nltk`, `scikit-learn` (TF-IDF), `beautifulsoup4`, `requests`, `neo4j`
- [ ] **Frontend Dependencies**: Add visualization libraries to `frontend/package.json`:
  - `d3`, `cytoscape`, `@types/d3`, TypeScript graph utilities
- [ ] **Environment Setup**: Update `.env.example` with Neo4j connection details
- [ ] **Test Build**: Ensure all services build and start successfully

#### **Hours 3-4: Backend NLP Pipeline Core**
- [ ] **Web Scraper Module** (`backend/src/scraper.py`):
  - Fetch URL content with proper headers/error handling
  - Extract title, meta description, main text content
  - Handle common web page structures and edge cases
- [ ] **NLP Processor Module** (`backend/src/nlp_processor.py`):
  - SpaCy pipeline for named entity recognition (PERSON, ORG, GPE, CONCEPT)
  - NLTK for keyword extraction and sentence segmentation
  - TF-IDF for topic/theme identification across documents
  - Similarity scoring between documents using cosine similarity
- [ ] **Graph Builder Module** (`backend/src/graph_builder.py`):
  - Neo4j connection and basic CRUD operations
  - Entity relationship mapping logic (entities ↔ documents, entity ↔ entity)
  - Graph metrics calculation (centrality, clustering)

#### **Hours 5-6: Backend API Endpoints**
- [ ] **POST `/process-bookmarks`**:
  - Accept bookmark URLs (JSON array or browser export format)
  - Trigger scraping → NLP processing → graph building pipeline
  - Return processing status and basic stats
- [ ] **GET `/graph-data`**:
  - Export graph as JSON for frontend visualization
  - Include nodes (entities, documents) and edges (relationships)
  - Add metadata (weights, categories, centrality scores)
- [ ] **GET `/search/{query}`**:
  - Search entities and documents by keyword
  - Return relevant subgraphs for focused visualization
- [ ] **WebSocket `/processing-status`**:
  - Real-time updates during bookmark processing
  - Progress indicators and error reporting

#### **Hours 7-8: Frontend Core Interface**
- [ ] **Bookmark Input Component** (`frontend/src/lib/BookmarkInput.svelte`):
  - Textarea for pasting bookmark URLs or browser export files
  - File upload for `.html` bookmark files
  - URL validation and format detection
  - Submit button with loading states
- [ ] **Processing Dashboard** (`frontend/src/lib/ProcessingStatus.svelte`):
  - Real-time progress updates via WebSocket
  - Processing stage indicators (Scraping → NLP → Graph Building)
  - Error handling and retry mechanisms
- [ ] **Graph Visualization Setup**: Prepare container and basic D3.js/Cytoscape integration

#### **Hours 9-10: Graph Visualization Magic**
- [ ] **Interactive Graph Component** (`frontend/src/lib/GraphVisualizer.svelte`):
  - Force-directed layout with customizable physics
  - Node styling by type (entities vs documents) and importance
  - Edge styling by relationship strength/type
  - Zoom, pan, and node selection interactions
- [ ] **Graph Controls** (`frontend/src/lib/GraphControls.svelte`):
  - Layout algorithm selection (force-directed, hierarchical, circular)
  - Filter by entity types, relationship strength, document categories
  - Search and highlight functionality
  - Export options (PNG, SVG, JSON)

#### **Hours 11-12: Polish & Production Readiness**
- [ ] **UI/UX Enhancement**:
  - Modern, responsive design with dark/light theme
  - Loading animations and micro-interactions
  - Tooltips and information panels for graph elements
  - Mobile-friendly responsive layout
- [ ] **Error Handling & Edge Cases**:
  - Invalid URLs, scraping failures, rate limiting
  - Empty or low-content pages
  - Large bookmark sets (performance optimization)
- [ ] **Demo Data & Tutorial**:
  - Pre-loaded example bookmark set for immediate demo
  - Interactive tutorial overlay for first-time users
  - Clear instructions and expected input formats

### Technical Implementation Details

#### **NLP Processing Strategy (No LLM)**
1. **Entity Extraction**: SpaCy's pre-trained models for robust NER
2. **Topic Modeling**: TF-IDF + clustering for thematic grouping
3. **Relationship Inference**: Co-occurrence analysis and semantic similarity
4. **Document Similarity**: Cosine similarity on TF-IDF vectors
5. **Keyword Extraction**: TextRank algorithm + POS filtering

#### **Graph Data Model**
```cypher
// Nodes
(:Document {url, title, summary, processing_date, category})
(:Entity {name, type, importance_score, frequency})
(:Topic {name, keywords, document_count})

// Relationships
(doc)-[:MENTIONS {confidence, context}]->(entity)
(entity)-[:CO_OCCURS {strength, doc_count}]->(entity)
(doc)-[:SIMILAR_TO {similarity_score}]->(doc)
(doc)-[:BELONGS_TO]->(topic)
```

#### **Performance Targets**
- **Scraping**: ~1-2 seconds per URL (with proper rate limiting)
- **NLP Processing**: ~0.5 seconds per document
- **Graph Building**: ~0.1 seconds per document
- **Visualization**: Smooth 60fps for up to 500 nodes
- **Total Pipeline**: <30 seconds for 20-50 bookmark URLs

#### **Deployment Configuration**
- **Docker**: Multi-stage builds for production optimization
- **Nginx**: Reverse proxy with static file serving
- **Environment**: Production-ready secrets management
- **Monitoring**: Basic health checks and error logging
- **Domain**: SSL/HTTPS setup for `remediate.app`

### Success Criteria for MVP Launch
1. **Functional**: Users can input bookmarks and see knowledge graph within 60 seconds
2. **Visual**: Impressive, interactive graph that reveals hidden connections
3. **Stable**: Handles edge cases gracefully, no crashes on invalid input
4. **Fast**: Responsive UI, smooth animations, reasonable processing times
5. **Accessible**: Works on mobile, clear UX, intuitive interactions
6. **Demonstrable**: Ready for social media demos and user feedback

### Post-MVP Enhancement Ideas
- **Export Features**: PDF reports, CSV data, API integrations
- **Collaboration**: Shareable graphs, team bookmark collections
- **Analytics**: Document clustering insights, reading recommendations
- **Integrations**: Browser extensions, Pocket/Readwise sync
- **AI Enhancement**: LLM-powered summarization and relationship detection

This MVP serves as the foundation for the full BMX vision while delivering immediate value and impressive visual impact. The lightweight NLP approach ensures fast processing and broad compatibility, making it perfect for rapid user adoption and feedback collection.

Let's build something amazing! 🔥

## Agentic Knowledge Ingestion & Synthesis MVP Framework (Revised for PDF Processing)

This outlines the initial, simplified version of the agentic process for ingesting, processing, and integrating new knowledge, focusing on a local directory of PDF files. This process is manually triggered by the user.

1.  **Input Source Definition:**
    *   **Mechanism:** User specifies a local directory containing PDF files to be processed. The agent can be pointed to this directory upon execution or have a configurable default input directory.
    *   **Scope (MVP):** Focus on processing PDF documents from this local directory.

2.  **Manual Trigger & File Discovery:**
    *   **Mechanism (MVP):** A script (e.g., a Python script executed from the command line) that the user runs manually.
    *   **Action:** The agent scans the specified input directory (and its subdirectories, optionally) for PDF files (`.pdf`). It can maintain a list of already processed files (e.g., in PostgreSQL) to avoid redundant processing.
    *   **Error Handling (MVP):** Basic logging of successfully identified/skipped/failed-to-access PDF files to a file or console.

3.  **Content Processing & Initial Storage (PDFs):**
    *   **Text Extraction:** Use a robust Python library (e.g., `PyPDF2`, `pdfminer.six`, or `fitz` from PyMuPDF) to extract textual content from each new PDF file.
        *   Consider strategies for handling scanned PDFs (OCR might be out of scope for MVP but note it as a future enhancement if needed).
        *   Handle potential extraction errors gracefully for problematic PDFs.
    *   **Raw Storage (PostgreSQL):**
        *   Modify or use the `raw_documents` table (or create a new `pdf_documents` table).
        *   Fields: `id` (PK), `file_path` (TEXT, UNIQUE, absolute path to the PDF), `file_hash` (TEXT, e.g., SHA256 hash of the file to detect changes if re-processed), `processed_at` (TIMESTAMP), `extracted_text_content` (TEXT), `processing_status` (TEXT, e.g., 'pending_summary', 'summarized', 'graphed', 'failed_extraction', 'failed_summary').
        *   Store the original file path and the extracted clean text.

4.  **LLM-Powered Condensation (Summarization):**
    *   **Mechanism:** For each document with 'pending_summary' status, send its `extracted_text_content` to the Gemini API.
    *   **Prompt (MVP):** "Summarize the core arguments, key findings, and main topics of the following text extracted from a PDF document. Identify the primary purpose or thesis if apparent. Aim for a concise yet comprehensive summary (e.g., 300-500 words, or user-configurable length)."
    *   **Storage (PostgreSQL):**
        *   Use or adapt the `processed_summaries` table.
        *   Fields: `id` (PK), `source_document_id` (FK to `raw_documents`/`pdf_documents`), `summary_text` (TEXT), `llm_model_used` (TEXT), `generated_at` (TIMESTAMP).
        *   Store the generated summary and update `processing_status` in the source document table to 'summarized'.

5.  **LLM-Powered Knowledge Element Extraction (Simplified):**
    *   **Mechanism:** For each new `processed_summary`, send its `summary_text` (or potentially the full `extracted_text_content` for more detail if summaries are too brief) to the Gemini API.
    *   **Prompt (MVP):** "From the following text, identify key named entities (people, organizations, locations, seminal works, core concepts/theories) and the primary relationships between them relevant to understanding the document's main points. Output this as a JSON object with two keys: 'entities' (a list of objects, each with 'name' and 'type') and 'relationships' (a list of objects, each with 'source_entity_name', 'relationship_type', 'target_entity_name'). Example entity types: 'Person', 'Concept', 'Theory', 'Publication'. Example relationship types: 'DISCUSSES', 'CITES', 'CRITIQUES', 'EXPANDS_ON', 'CONTRASTS_WITH'."
    *   **Storage (PostgreSQL):** Add a field like `kg_elements_json` (TEXT or JSONB) to the `processed_summaries` table or the source document table.

6.  **Graph Population (Basic Neo4j Integration):**
    *   **Mechanism:** A script parses the `kg_elements_json`.
    *   **Node Creation (Neo4j):**
        *   `Document Node`: For each processed PDF, create/merge a `(:Document {sourcePath: original_file_path, type: "PDF", title: "Extracted/LLM-Generated Title or Filename"})` node. Link this to its `summary_id` in PostgreSQL if summaries are separate nodes/tables, or store summary directly if preferred.
        *   `Entity Nodes`: For each unique entity from the JSON: `MERGE (e:Entity {name: entity.name, type: entity.type})`.
    *   **Relationship Creation (Neo4j):**
        *   Link Document to Entities: `MATCH (d:Document {sourcePath: file_path}), (e:Entity {name: entity.name}) MERGE (d)-[:MENTIONS_ENTITY {context: "Optional snippet from text"}]->(e)`.
        *   Link Entities to Entities: `MATCH (source:Entity {name: source_entity_name}), (target:Entity {name: target_entity_name}) MERGE (source)-[rel:RELATED_TO {type: relationship_type_from_json, context: "Optional summary of relation"}]->(target)`.
        *   **Attribution:** The `sourcePath` on the `Document` node provides direct traceability to the PDF file.
        *   **Status Update:** Update `processing_status` in the source document table to 'graphed'.

7.  **Basic Retrievability & Verification (MVP):**
    *   **Mechanism:** Simple scripts, direct database queries (SQL and Cypher), or a very basic API endpoint (potentially using the GraphQL schema later).
    *   **Action:**
        *   Ability to query PostgreSQL for summaries by PDF file path or keyword in extracted text/summary.
        *   Ability to query Neo4j for `Document` nodes (representing PDFs) and see their connected `Entity` nodes.
        *   Verify that entities and relationships extracted appear reasonable for a given PDF.

This revised MVP focuses the agent on a batch processing task for local PDFs, controllable by the user. It retains the core pipeline (extract -> summarize -> extract knowledge elements -> store in graph) while simplifying operational aspects for an initial build.

## Long-Term Hosting & Infrastructure Strategy (Condensed)

This section complements the phased implementation plan by outlining the recommended cloud infrastructure for long-term sustainability, scalability, and maintainability by a solo developer.

*   **Core Principle:** Prioritize managed services to reduce operational overhead.
*   **Neo4j Graph Database:**
    *   **Service:** Neo4j AuraDB (specifically AuraDB Free tier for initial development).
    *   **Rationale:** Fully managed, handles backups, scaling, HA. No-cost entry.
    *   **Dependencies:** Account with Neo4j Aura.
    *   **Expected Time-to-Complete (Initial Setup):** 1-2 hours (account creation, database provisioning, connection string acquisition).
*   **PostgreSQL Relational Database & Backend Hosting:**
    *   **Primary Recommendation:** Google Cloud Platform (GCP).
        *   **Services:**
            *   PostgreSQL: Google Cloud SQL for PostgreSQL (managed service, has free tier options).
            *   Backend (FastAPI): Google Cloud Run or App Engine (serverless/managed compute).
        *   **Rationale:** Strong AI/ML ecosystem (synergy with Gemini API), robust managed services.
        *   **Dependencies:** GCP account.
        *   **Expected Time-to-Complete (Initial Setup):** 2-4 hours (account setup, enabling APIs, provisioning Cloud SQL, initial app deployment to Cloud Run/App Engine).
    *   **Strong Alternative:** Amazon Web Services (AWS).
        *   **Services:**
            *   PostgreSQL: Amazon RDS for PostgreSQL (managed service, often generous free tier).
            *   Backend (FastAPI): AWS App Runner, Elastic Beanstalk, or Lambda+API Gateway.
        *   **Rationale:** Mature, broad ecosystem, excellent managed services, potentially more generous SQL free tier.
        *   **Dependencies:** AWS account.
        *   **Expected Time-to-Complete (Initial Setup):** 2-4 hours (similar to GCP).
*   **General Dependencies (already covered but reinforced):**
    *   Docker & Docker Compose: For local development and containerization consistency.
    *   Git: For version control.
    *   Poetry/Yarn: For application dependency management.
*   **Transition Strategy:**
    *   Initially, continue using Docker Compose for local development as outlined.
    *   When ready to deploy "Phase 1" or "Phase 2" components to the cloud:
        1.  Set up AuraDB and migrate/point existing Neo4j data/logic.
        2.  Set up managed PostgreSQL (Cloud SQL or RDS) and migrate/point existing PostgreSQL data/logic.
        3.  Containerize the FastAPI backend (if not already fully optimized for cloud deployment) and deploy to Cloud Run/App Engine (GCP) or App Runner/Elastic Beanstalk (AWS).
        4.  Update application configurations (e.g., `.env` files or secrets management) to use cloud service connection strings and API keys.

## (Future) LLM Integration Principles

*   **LLM Choice**: Google Gemini API.
*   **Output Priorities**:
    1.  **Factual**: Accurate to source.
    2.  **Verifiable**: Traceable to sources.
    3.  **Holistic**: Leverages graph connections.
    4.  **Concise**: Effectively summarized.
