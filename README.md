# BMX-bookmark-extractor

![](https://github.com/cooperability/BMX-bookmark-extractor/blob/main/Screen%20Recording%202023-09-18%20at%201.07.22%20PM.gif)
Infrastructure snippets building toward a comprehensive scraping-NLP pipeline for web links.

## Setup

### Prerequisites
- Docker installed on your system
- Git (optional, for cloning the repository)

### Steps

1. Clone the repository (if you haven't already):
   ```
   git clone https://github.com/cooperability/BMX-bookmark-extractor.git
   cd BMX-bookmark-extractor
   ```

2. Build the Docker image:
   ```
   docker build -t bmx .
   ```

3. Run the Docker container:
   ```
   docker run -p 8080:8080 bmx
   ```

4. Access the application:
   Open your web browser and navigate to `http://localhost:8080`

### Configuration

The application uses several AI models and libraries. These are automatically installed during the Docker build process. The main components are:

- Flask web framework
- spaCy for NLP tasks
- Transformers library for T5 summarization and MobileBERT sentiment analysis
- BeautifulSoup for web scraping

You can view the full list of dependencies in the `requirements.txt` file.

### Development

If you want to make changes to the application:

1. Modify the necessary files in the `app` directory.
2. Rebuild the Docker image:
   ```
   docker build -t bmx .
   ```
3. Run the new container to test your changes.

### Troubleshooting

If you encounter any issues:

1. Ensure Docker is running on your system.
2. Check if the required ports are available (8080 by default).
3. Review the Docker logs for any error messages:
   ```
   docker logs <container_id>
   ```

For more detailed information about the application structure and functionality, refer to the `app.py` file.

This setup process using Docker ensures a consistent environment across different systems and simplifies the deployment process.

## Dependencies

- **fastapi**: Required for building the API.
- **uvicorn**: ASGI server for running FastAPI.
- **sqlalchemy**: ORM for database interactions.
- **pydantic**: Data validation and settings management.
- **asyncpg**: Async PostgreSQL client.
- **beautifulsoup4**: HTML and XML parsing.
- **requests**: HTTP requests.
- **PyPDF2**: PDF manipulation.
- **spacy**: NLP library.
- **youtube-transcript-api**: Fetch YouTube transcripts.
- **python-dotenv**: Load environment variables from `.env` file.
- **neo4j**: Neo4j database driver.
- **pinecone**: Vector database service.
- **numpy**: Numerical computations.


- Pitch
    
    BMX (BookMark eXtractor) synthesizes complex, multi-disciplinary information into actionable, personalized advice. It will index data from a variety of articles, research papers, books, Audio Transcripts, and scraped web pages. By leveraging a user-created graph database sending targeted clusters of academic literature to an LLM, BMX goes past aggregation and synthesis to UNDERSTAND user data. It bridges the gap between vast knowledge repositories, pragmatic personal advice, and bespoke professional opinion. The central, key use case is the generation of nuanced, detailed, research-backed advice. A secondary use case is interdisciplinary academic research synthesis, though one can see how this serves the central use case. If a killer app gets made, there are few human industries BMX WON’T disrupt.
    
- Key Use Case
    
    An example use case: “Draw on all literature in the database pertaining to relationships, love, psychology, neurodivergence, and parenting. Advise a young, successful couple whose sex life has died because they are struggling to effectively communicate with their autistic child and keep up with their busy careers. “These situations will be diverse, nuanced and impossible to predict; thus answers MUST be generated according to the priorities below. This should flawlessly work for ANY kind of therapist/life coach drawing on ANY kind of literature.
    
- Output Priorities
    1. **Factual:** Utterly factually accurate to the source documents
    2. **Verifiable:** Fully cited
    3. **Holistic:** maximally nuanced & multifaceted analysis
    4. **Concise**: effectively summarized
- Stack
    -BMX will implement a hybrid database approach using both Neomodel (Object Graph Mapper) and direct Neo4j queries. This strategy leverages Django-like structured data management for document metadata while maintaining Neo4j's powerful graph capabilities for semantic relationships. The hybrid approach allows for rapid initial development using familiar ORM patterns while preserving the ability to perform complex graph operations for cross-document analysis. This dual-interface strategy provides maximum flexibility: structured operations can use Neomodel's ORM-like syntax, while complex semantic queries can utilize Neo4j's native graph capabilities.
    - Neo4j: Graph database for complex relationship modeling
        - Neo4j Rust Driver: Official Neo4j driver for Rust applications
    - Pinecone: Vector database for efficient similarity search
    - FastAPI: High-performance Python web framework
    - LLaMA: Open-source language model for natural language processing
    - Docker: Containerization for consistent development and deployment
    - Poetry: Dependency management for Python
    - Pytest: Testing framework for robust code quality
    - Frontend: Next.js for server-side rendering and SEO benefits
    - Deployment: Vercel for frontend, DigitalOcean App Platform for backend
    - LLM Integration: Hugging Face's transformers library for flexible model choices
    - Rust: High-performance, safe systems programming language for the core API backend
    - Actix Web: Rust web framework for building efficient, scalable HTTP services
    - Python: For specialized NLP and ML tasks, integrated as microservices
    - Security & Dependency Management:
        - Poetry for deterministic builds
        - Regular security audits via Dependabot
        - Version pinning strategy: Security patches > Minor updates > Major versions
- PRD & Implementation Agenda:
    - **Phase 1**: Core Infrastructure Setup (Weeks 1-4)
        - Set up Rust development environment
        - Design and implement basic API structure using Actix Web
        - Integrate Neo4j Rust driver for database operations, design schema
        - Integrate Pinecone for vector storage
        - Refactor existing FastAPI structure for new databases
        - Add environment variables to connect Neo4j and Pinecone
        - Implement basic ingestion pipeline for literature
        - Neo4j Setup (When ready in Phase 1):
            - Create a new instance
            - Note connection details (URI, username, password)
            - Update configuration to use Neo4j connection details
        - Pinecone Setup (When ready in Phase 1):
            - Create a new index
            - Note API key and environment
            - Update configuration with Pinecone details
        - Implement automated dependency security scanning
        - Establish version management protocols for critical dependencies
    - **Phase 2**: Knowledge Processing (Weeks 5-8)
        - Implement core functionalities for text ingestion and processing in Rust
        - Create Python microservices for specialized NLP tasks
        - Design and implement inter-service communication (e.g., gRPC or REST)
        - Implement the service modules (pdf_service, web_service, youtube_service, query_service).
        - Implement entity extraction and relationship mapping for Neo4j
        - Create vector embedding generation for Pinecone; Design and implement the reasoning engine
    - **Phase 3**: LLM Integration and Query System (Weeks 9-12)
        - Integrate LLaMA model for natural language understanding
        - Develop query processing/response generation system using graph data and LLM
        - Create API endpoints for user interactions
    - **Phase 4**: Systematic testing, optimization, and security audit of all components (Weeks 13-16)
    - **Phase 5**: Deployment and Scaling (Weeks 17-20)
        - Set up cloud infrastructure & prepare the Docker configuration for deployment.
        - Plan the deployment strategy for DigitalOcean or another hosting provider.
        - Implement production monitoring and logging
        - Develop documentation and user guides
        - Beta launch and feedback collection
        - Look into Google Ad revenue, donation button, etc
- Coding Form Guidelines:
    - Provide context for code changes, specifying WHERE TO ADD/MODIFY CODE/FILES/DEPENDENCIES
    - Prioritize readability, modifiability, clarity, logic, best practices, existing project conventions, in that order.
    - Include robust try/catch/handle exception cases and log verbose errors wherever possible.
    - Product should be functional and impressive above all, but also lightweight and low-overhead as a close second priority.
    - Build robust, flexible, and scalable interfaces with efficient code, minimizing #lines where possible.
    - Implement comprehensive error handling and logging
    - Format responses in markdown for clarity
    - Specify language identifiers in code blocks
    - When modifying existing files, show only the changes with context
    - Leverage Rust's ownership system and type safety for robust, efficient code
    - Use Rust idioms and best practices for performant, maintainable APIs
    - Implement comprehensive error handling using Rust's Result type

1. **Windows + Git Bash Environment Considerations**
    - Project initially assumed Unix-like environment, but runs on Windows using Git Bash
    - Docker commands need to account for Windows path conventions and potential line ending issues
    - Some Unix-style commands need `winpty` prefix in Git Bash
2. **Docker Permission Management**
    - Work computer restrictions require strict containerization
    - Permission errors for Python packages (e.g., `mdurl`, `typing-extensions`) indicate need for complete Docker isolation
    - Solution requires proper user permissions and volume mounting strategy rather than system-wide installations
3. **Poetry Lock File Generation**
    - Catch-22 situation discovered: Container needs lock file to build, but lock file generation needs container
    - Current setup doesn't handle missing `poetry.lock` gracefully, causing build failures
    - Need for a bootstrapping process to generate initial lock file

Rust Study Guide Outline:
Week 1-2: Fundamentals
Day 1-2: Rust syntax, variables, and basic types
Day 3-4: Control flow, functions, and modules
Day 5-7: Ownership, borrowing, and lifetimes
Day 8-10: Structs, enums, and pattern matching
Day 11-14: Error handling, generics, and traits
Week 3-4: Intermediate Concepts
Day 15-17: Advanced trait usage and trait objects
Day 18-20: Closures and iterators
Day 21-23: Smart pointers and interior mutability
Day 24-26: Concurrency and parallelism in Rust
Day 27-28: Unsafe Rust and FFI
Month 2: Application-Specific Topics
Week 1: Web frameworks (e.g., Actix, Rocket) and RESTful API design
Week 2: Database interactions (Neo4j driver for Rust)
Week 3: Asynchronous programming in Rust
Week 4: Testing, benchmarking, and optimizing Rust code

Pinecone alternatives:
a. Milvus: An open-source vector database that supports similarity search and AI-powered analytics.
b. Qdrant: A vector similarity search engine with extended filtering support.
c. Weaviate: An open-source vector database that can be used for various AI-powered applications.

## Docker Development Setup

### Prerequisites
- Docker and Docker Compose installed
- Git (for version control)

### Development Workflow
1. Start the development environment:
   ```bash
   docker-compose up frontend --build
   ```

2. Access the application:
   - Frontend: http://localhost:3000

### Production Deployment
For production deployment:
1. Build using production target:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. Deploy using your preferred platform (Vercel recommended for frontend)

### Security Considerations
- Regular security audits using:
  ```bash
  npm audit
  docker scan frontend
  ```
- Keep base images updated
- Monitor dependencies for vulnerabilities

### Performance Optimization
- Frontend build optimization:
  ```bash
  docker-compose exec frontend npm run build
  ```
- Monitor bundle size:
  ```bash
  docker-compose exec frontend npm run analyze
  ```

### Troubleshooting
If you encounter permission issues:
1. Check volume permissions
2. Ensure Docker daemon is running
3. Review logs:
   ```bash
   docker-compose logs frontend
   ```