# Agentic Knowledge Ingestion & Synthesis Framework (PDF Processing)

This outlines the initial, simplified version of the agentic process for ingesting, processing, and integrating new knowledge, focusing on a local directory of PDF files. This process is manually triggered by the user.

## Overview

The PDF processing framework serves as a foundation for BMX's knowledge ingestion capabilities, demonstrating the core pipeline before scaling to web content and other sources.

## Process Flow

### 1. Input Source Definition
**Mechanism:** User specifies a local directory containing PDF files to be processed. The agent can be pointed to this directory upon execution or have a configurable default input directory.

**Scope (MVP):** Focus on processing PDF documents from this local directory.

### 2. Manual Trigger & File Discovery
**Mechanism (MVP):** A script (e.g., a Python script executed from the command line) that the user runs manually.

**Action:** The agent scans the specified input directory (and its subdirectories, optionally) for PDF files (`.pdf`). It can maintain a list of already processed files (e.g., in PostgreSQL) to avoid redundant processing.

**Error Handling (MVP):** Basic logging of successfully identified/skipped/failed-to-access PDF files to a file or console.

### 3. Content Processing & Initial Storage (PDFs)
**Text Extraction:** Use a robust Python library (e.g., `PyPDF2`, `pdfminer.six`, or `fitz` from PyMuPDF) to extract textual content from each new PDF file.
- Consider strategies for handling scanned PDFs (OCR might be out of scope for MVP but note it as a future enhancement if needed).
- Handle potential extraction errors gracefully for problematic PDFs.

**Raw Storage (PostgreSQL):**
- Modify or use the `raw_documents` table (or create a new `pdf_documents` table).
- Fields: `id` (PK), `file_path` (TEXT, UNIQUE, absolute path to the PDF), `file_hash` (TEXT, e.g., SHA256 hash of the file to detect changes if re-processed), `processed_at` (TIMESTAMP), `extracted_text_content` (TEXT), `processing_status` (TEXT, e.g., 'pending_summary', 'summarized', 'graphed', 'failed_extraction', 'failed_summary').
- Store the original file path and the extracted clean text.

### 4. LLM-Powered Condensation (Summarization)
**Mechanism:** For each document with 'pending_summary' status, send its `extracted_text_content` to the Gemini API.

**Prompt (MVP):** "Summarize the core arguments, key findings, and main topics of the following text extracted from a PDF document. Identify the primary purpose or thesis if apparent. Aim for a concise yet comprehensive summary (e.g., 300-500 words, or user-configurable length)."

**Storage (PostgreSQL):**
- Use or adapt the `processed_summaries` table.
- Fields: `id` (PK), `source_document_id` (FK to `raw_documents`/`pdf_documents`), `summary_text` (TEXT), `llm_model_used` (TEXT), `generated_at` (TIMESTAMP).
- Store the generated summary and update `processing_status` in the source document table to 'summarized'.

### 5. LLM-Powered Knowledge Element Extraction (Simplified)
**Mechanism:** For each new `processed_summary`, send its `summary_text` (or potentially the full `extracted_text_content` for more detail if summaries are too brief) to the Gemini API.

**Prompt (MVP):** "From the following text, identify key named entities (people, organizations, locations, seminal works, core concepts/theories) and the primary relationships between them relevant to understanding the document's main points. Output this as a JSON object with two keys: 'entities' (a list of objects, each with 'name' and 'type') and 'relationships' (a list of objects, each with 'source_entity_name', 'relationship_type', 'target_entity_name'). Example entity types: 'Person', 'Concept', 'Theory', 'Publication'. Example relationship types: 'DISCUSSES', 'CITES', 'CRITIQUES', 'EXPANDS_ON', 'CONTRASTS_WITH'."

**Storage (PostgreSQL):** Add a field like `kg_elements_json` (TEXT or JSONB) to the `processed_summaries` table or the source document table.

### 6. Graph Population (Basic Neo4j Integration)
**Mechanism:** A script parses the `kg_elements_json`.

**Node Creation (Neo4j):**
- `Document Node`: For each processed PDF, create/merge a `(:Document {sourcePath: original_file_path, type: "PDF", title: "Extracted/LLM-Generated Title or Filename"})` node. Link this to its `summary_id` in PostgreSQL if summaries are separate nodes/tables, or store summary directly if preferred.
- `Entity Nodes`: For each unique entity from the JSON: `MERGE (e:Entity {name: entity.name, type: entity.type})`.

**Relationship Creation (Neo4j):**
- Link Document to Entities: `MATCH (d:Document {sourcePath: file_path}), (e:Entity {name: entity.name}) MERGE (d)-[:MENTIONS_ENTITY {context: "Optional snippet from text"}]->(e)`.
- Link Entities to Entities: `MATCH (source:Entity {name: source_entity_name}), (target:Entity {name: target_entity_name}) MERGE (source)-[rel:RELATED_TO {type: relationship_type_from_json, context: "Optional summary of relation"}]->(target)`.
- **Attribution:** The `sourcePath` on the `Document` node provides direct traceability to the PDF file.
- **Status Update:** Update `processing_status` in the source document table to 'graphed'.

### 7. Basic Retrievability & Verification (MVP)
**Mechanism:** Simple scripts, direct database queries (SQL and Cypher), or a very basic API endpoint (potentially using the GraphQL schema later).

**Action:**
- Ability to query PostgreSQL for summaries by PDF file path or keyword in extracted text/summary.
- Ability to query Neo4j for `Document` nodes (representing PDFs) and see their connected `Entity` nodes.
- Verify that entities and relationships extracted appear reasonable for a given PDF.

## Implementation Notes

This revised MVP focuses the agent on a batch processing task for local PDFs, controllable by the user. It retains the core pipeline (extract → summarize → extract knowledge elements → store in graph) while simplifying operational aspects for an initial build.

**Future Enhancements:**
- OCR support for scanned PDFs
- Automatic scheduling and monitoring
- Web content ingestion using similar pipeline
- Advanced relationship inference
- Cross-document similarity analysis
- User feedback integration for improving extraction quality 