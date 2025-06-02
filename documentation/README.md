# BMX Documentation & Planning

This directory contains design documents, implementation plans, and educational content for BMX development.

## Documentation Structure

### Planning & Design
- **[Implementation Plan](implementation-plan.md)** - Phased development roadmap (Weeks 1-16+)
- **[MVP Specification](mvp-plan.md)** - 1-Day MVP for bookmark knowledge graph
- **[Anki Integration](anki-integration.md)** - Comprehensive guide for Anki flashcard integration with hybrid architecture
- **[PDF Processing Framework](pdf-processing.md)** - Agentic knowledge ingestion for local PDFs
- **[Infrastructure Strategy](infrastructure.md)** - Long-term cloud hosting and deployment

### Knowledge Base Content
- **[Educational Content](educational/)** - Structured learning materials for LLM integration
  - Python fundamentals, intermediate, and advanced concepts
  - NLP course materials and techniques
  - Jupyter notebooks with executable examples

### Technical Reference
- **[System Architecture & Data Flow](system-architecture-flow.md)** - Mermaid diagrams showing complete user and data flows
- **[Hybrid Database Architecture](hybrid-database-architecture.md)** - PostgreSQL + Neo4j strategy and implementation
- **[LLM Integration](llm-integration.md)** - Google Gemini API principles and patterns
- **[Graph Database Design](graph-design.md)** - Neo4j data models and relationships
- **[Architecture Decisions](architecture/)** - Technical decision logs and rationale

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

## Using This Documentation

**For Development:**
1. Start with [Implementation Plan](implementation-plan.md) for current phase objectives
2. Reference component-specific READMEs in `backend/`, `frontend/`, `.devcontainer/`
3. Use [MVP Specification](mvp-plan.md) for rapid prototyping goals

**For Deployment:**
1. Follow [Infrastructure Strategy](infrastructure.md) for cloud setup
2. Reference environment configuration in project root `.env.example`
3. Use containerized deployment patterns established in Docker configurations

**For Learning:**
1. Explore [Educational Content](educational/) for structured learning materials
2. Run Jupyter notebooks locally for hands-on practice
3. Contribute additional learning materials following established metadata patterns 