# BMX Implementation Plan

## Phased Development Roadmap (Focus on Knowledge Pipeline)

### Phase 1: Neo4j Setup & Initial Anki Ingestion (Weeks 1-3)
**Focus:** Establish Neo4j, define data model for Anki, implement parser and ingestion scripts, basic FastAPI for Neo4j.

**Deliverables:**
- Neo4j service integrated into docker-compose
- Anki export parser (CSV/JSON formats)
- Basic graph data model for flashcard content (lightweight nodes with PostgreSQL references)
- FastAPI endpoints for Anki data ingestion
- Initial graph visualization capabilities

### Phase 2: PostgreSQL Integration & Hybrid Storage Strategy (Weeks 4-5)
**Focus:** Implement PostgreSQL (Supabase) for primary data storage, establish hybrid architecture patterns.

**Deliverables:**
- **PostgreSQL service** integrated for primary content storage
- **Hybrid data model**: PostgreSQL stores content, Neo4j stores relationships
- **SQLAlchemy models** for documents, entities, and summaries
- **Reference strategy**: UUID-based linking between databases
- **Event-driven synchronization** between PostgreSQL and Neo4j
- **API endpoints** for both graph traversal and content retrieval

### Phase 3: Web Content Ingestion Pipeline - Foundation (Weeks 6-8)
**Focus:** Develop web scraping, initial non-LLM condensation (SpaCy/NLTK), hybrid storage implementation.

**Deliverables:**
- Web scraping module with robust error handling
- Content extraction and cleaning pipeline
- SpaCy/NLTK processing for entity recognition
- TF-IDF based topic extraction
- **Hybrid storage implementation**: Content in PostgreSQL, relationships in Neo4j
- Document similarity analysis using cross-database queries

### Phase 4: LLM-Enhanced Condensation & Graph Population (Weeks 9-12)
**Focus:** Integrate Gemini API for content processing, populate knowledge graph with relationships.

**Deliverables:**
- Google Gemini API integration
- LLM-powered content summarization (stored in PostgreSQL)
- Entity relationship extraction (mapped to Neo4j relationships)
- **Graph-guided LLM queries**: Use Neo4j to guide content retrieval from PostgreSQL
- Cross-document relationship detection
- Enhanced graph visualization with content drill-down capabilities

### Phase 5: Advanced Querying & Hybrid Data Access (Weeks 13-16+)
**Focus:** Sophisticated querying leveraging both databases, optimized LLM integration.

**Deliverables:**
- **Graph-first query pattern**: Neo4j for structure discovery, PostgreSQL for content
- Natural language query interface with hybrid data access
- Context-aware LLM responses using both graph structure and detailed content
- GraphQL API for flexible hybrid querying
- Advanced graph analytics with content correlation
- Query optimization and intelligent caching (Redis layer)
- Performance monitoring for cross-database operations

### Phase 6: Production Deployment & Optimization (Ongoing)
**Focus:** Supabase + Neo4j AuraDB deployment, performance optimization.

**Deliverables:**
- **Supabase PostgreSQL** production deployment with real-time features
- **Neo4j AuraDB** integration for managed graph database
- Cross-database consistency monitoring and validation
- Performance optimization for hybrid queries
- User authentication and authorization across both systems
- API rate limiting and usage analytics
- Comprehensive backup and recovery strategies

## Current Status

BMX is currently in early Phase 1 with:
- ✅ Development environment established (Docker, containers)
- ✅ FastAPI backend foundation
- ✅ SvelteKit frontend foundation
- ✅ **Hybrid architecture strategy** defined and documented
- ✅ Basic project structure and tooling
- 🔄 Neo4j integration in progress
- ⏳ PostgreSQL hybrid storage design pending
- ⏳ Anki parsing and ingestion pending

## Next Steps

**Immediate Priorities (Next 2 weeks):**
1. Complete Neo4j service integration
2. **Design PostgreSQL schema** for content storage
3. **Implement hybrid reference strategy** (UUID linking)
4. Create first hybrid ingestion endpoint (Anki data)
5. Establish basic graph visualization with content drill-down

**Success Metrics:**
- Successfully ingest sample Anki deck using hybrid storage
- Demonstrate graph visualization with PostgreSQL content retrieval
- Validate cross-database synchronization patterns
- Document hybrid query performance characteristics

## Architecture Decision: Why Hybrid Database Strategy

This implementation plan reflects BMX's **hybrid PostgreSQL + Neo4j architecture**:

- **PostgreSQL (Supabase)**: Primary storage for large text content, detailed metadata, processing results
- **Neo4j**: Lightweight relationship mapping, graph traversal, visual exploration
- **Benefits**: Cost optimization (40-60% savings), performance optimization, scalability, enhanced user experience

See [Hybrid Database Architecture](hybrid-database-architecture.md) for detailed implementation guidance and best practices 