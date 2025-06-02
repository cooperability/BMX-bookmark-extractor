# Anki Integration with BMX Hybrid Architecture

## Overview

Anki flashcards serve as an excellent foundation for BMX's knowledge graph, providing structured learning content that can be enhanced with relationship mapping and cross-card connections.

## Why PostgreSQL for Anki Cards

**Anki cards are perfect for PostgreSQL storage:**
- **Content Volume**: Cards contain substantial text (questions, answers, explanations)
- **Metadata Rich**: Tags, decks, difficulty ratings, scheduling data
- **Full-Text Search**: Essential for finding cards by content
- **Cost Efficiency**: Much more economical than storing in Neo4j
- **JSONB Support**: Perfect for flexible card metadata and custom fields

## Data Model Strategy

### PostgreSQL Schema (Supabase)
```sql
-- Anki decks
CREATE TABLE anki_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Anki cards (primary content storage)
CREATE TABLE anki_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID REFERENCES anki_decks(id),
    
    -- Core card content
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    extra TEXT, -- Additional notes/explanations
    
    -- Anki-specific data
    note_type TEXT,
    tags TEXT[],
    
    -- Learning metadata
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    last_reviewed TIMESTAMP,
    
    -- BMX enhancements
    extracted_concepts TEXT[],
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    knowledge_domains TEXT[],
    
    -- Metadata and tracking
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search indexes
CREATE INDEX idx_anki_cards_content_search 
ON anki_cards USING GIN (to_tsvector('english', front || ' ' || back || ' ' || COALESCE(extra, '')));

CREATE INDEX idx_anki_cards_tags ON anki_cards USING GIN (tags);
CREATE INDEX idx_anki_cards_concepts ON anki_cards USING GIN (extracted_concepts);
```

### Neo4j Schema (Lightweight Relationship Mapping)
```cypher
// Lightweight card nodes
(:AnkiCard {
    id: "uuid-from-postgresql",
    title: "Brief front text (first 100 chars)",
    deck_name: "Deck name for clustering",
    difficulty: 3,
    domain: "nlp",
    node_size: 80 // For visualization
})

// Concept nodes extracted from cards
(:Concept {
    id: "uuid-from-postgresql",
    name: "Neural Networks",
    type: "technical_concept",
    frequency: 15, // How many cards mention this
    centrality_score: 0.85
})

// Rich relationships
(card)-[:TEACHES {
    confidence: 0.9,
    context: "Front side question about...",
    extraction_method: "llm"
}]->(concept)

(concept)-[:RELATED_TO {
    strength: 0.7,
    relationship_type: "prerequisite",
    discovered_via: "cross_card_analysis"
}]->(concept)

(card)-[:SIMILAR_TO {
    similarity_score: 0.8,
    shared_concepts: ["neural networks", "backpropagation"]
}]->(card)
```

## Anki CSV Import Process

### 1. Initial Data Import
```python
import pandas as pd
import asyncio
from uuid import uuid4

async def import_anki_csv(csv_path: str):
    """Import Anki cards from CSV export into hybrid database"""
    
    # Read Anki export CSV
    df = pd.read_csv(csv_path)
    
    # Process each card
    for _, row in df.iterrows():
        # 1. Store primary data in PostgreSQL
        card_id = await postgres.insert_card({
            'front': row['Front'],
            'back': row['Back'],
            'tags': row.get('Tags', '').split(),
            'deck_name': row.get('Deck', 'Default'),
            'note_type': row.get('Type', 'Basic')
        })
        
        # 2. Extract concepts using LLM
        concepts = await llm.extract_concepts(
            text=f"{row['Front']} {row['Back']}"
        )
        
        # 3. Update PostgreSQL with extracted concepts
        await postgres.update_card_concepts(card_id, concepts)
        
        # 4. Create lightweight Neo4j node
        await neo4j.create_card_node({
            'id': str(card_id),
            'title': row['Front'][:100],
            'deck_name': row.get('Deck', 'Default'),
            'concept_count': len(concepts)
        })
        
        # 5. Create concept relationships
        for concept in concepts:
            concept_id = await ensure_concept_exists(concept)
            await neo4j.create_relationship(
                card_id, concept_id, 'TEACHES',
                {'confidence': concept.confidence}
            )
```

### 2. Continuous Synchronization

**Supabase Webhooks for Real-Time Sync:**
```python
# Supabase webhook handler
@app.post("/webhooks/supabase/card-updated")
async def handle_card_update(webhook_data: dict):
    """Handle real-time card updates from Supabase"""
    
    if webhook_data['type'] == 'INSERT':
        # New card added - create Neo4j node
        card_id = webhook_data['record']['id']
        await sync_new_card_to_neo4j(card_id)
        
    elif webhook_data['type'] == 'UPDATE':
        # Card modified - update relationships
        card_id = webhook_data['record']['id']
        await refresh_card_relationships(card_id)
        
    elif webhook_data['type'] == 'DELETE':
        # Card deleted - clean up Neo4j
        card_id = webhook_data['old_record']['id']
        await neo4j.delete_node_and_relationships(card_id)

async def sync_new_card_to_neo4j(card_id: str):
    """Sync a new PostgreSQL card to Neo4j"""
    
    # Get full card data from PostgreSQL
    card = await postgres.get_card_by_id(card_id)
    
    # Extract concepts if not already done
    if not card.extracted_concepts:
        concepts = await llm.extract_concepts(
            f"{card.front} {card.back}"
        )
        await postgres.update_card_concepts(card_id, concepts)
        card.extracted_concepts = concepts
    
    # Create Neo4j node and relationships
    await neo4j.create_card_node({
        'id': card_id,
        'title': card.front[:100],
        'deck_name': card.deck_name,
        'concept_count': len(card.extracted_concepts)
    })
    
    # Create concept relationships
    for concept_name in card.extracted_concepts:
        concept_id = await ensure_concept_exists(concept_name)
        await neo4j.create_relationship(
            card_id, concept_id, 'TEACHES'
        )
```

## Advanced Anki Enhancement Features

### 1. Cross-Card Concept Discovery
```python
async def discover_cross_card_relationships():
    """Find relationships between cards based on shared concepts"""
    
    # Get cards with shared concepts from PostgreSQL
    shared_concepts_query = """
    SELECT c1.id as card1_id, c2.id as card2_id, 
           array_intersect(c1.extracted_concepts, c2.extracted_concepts) as shared
    FROM anki_cards c1, anki_cards c2 
    WHERE c1.id < c2.id 
    AND array_length(array_intersect(c1.extracted_concepts, c2.extracted_concepts), 1) >= 2
    """
    
    relationships = await postgres.fetch(shared_concepts_query)
    
    # Create Neo4j relationships for strongly related cards
    for rel in relationships:
        if len(rel['shared']) >= 3:  # Strong relationship threshold
            await neo4j.create_relationship(
                rel['card1_id'], rel['card2_id'], 'SIMILAR_TO',
                {
                    'similarity_score': len(rel['shared']) / 10.0,
                    'shared_concepts': rel['shared']
                }
            )
```

### 2. Learning Path Generation
```python
async def generate_learning_path(target_concept: str):
    """Generate optimal learning sequence using graph analysis"""
    
    # Use Neo4j to find prerequisite chains
    cypher = """
    MATCH path = (start:Concept)-[:PREREQUISITE*..5]->(target:Concept {name: $concept})
    RETURN path, length(path) as depth
    ORDER BY depth
    LIMIT 10
    """
    
    prerequisite_paths = await neo4j.run(cypher, concept=target_concept)
    
    # Get corresponding cards from PostgreSQL
    learning_sequence = []
    for path in prerequisite_paths:
        cards = await postgres.get_cards_for_concepts(
            [node['name'] for node in path.nodes]
        )
        learning_sequence.extend(cards)
    
    return learning_sequence
```

## Maintenance and Best Practices

### 1. Regular Anki Sync
```python
# Scheduled job for Anki synchronization
@scheduler.scheduled_job('interval', hours=6)
async def sync_anki_changes():
    """Periodic synchronization with Anki collection"""
    
    # Export fresh data from Anki
    latest_cards = await anki_connector.export_cards()
    
    # Compare with PostgreSQL and update changes
    await sync_card_changes(latest_cards)
    
    # Refresh Neo4j relationships for updated cards
    await refresh_all_card_relationships()
    
    # Validate database consistency
    await validate_anki_consistency()
```

### 2. Performance Optimization
```python
# Optimized batch operations for large Anki collections
async def batch_process_cards(cards: List[dict], batch_size: int = 100):
    """Process Anki cards in optimized batches"""
    
    for i in range(0, len(cards), batch_size):
        batch = cards[i:i + batch_size]
        
        # Batch PostgreSQL operations
        card_ids = await postgres.bulk_insert_cards(batch)
        
        # Batch LLM concept extraction
        concepts_batch = await llm.extract_concepts_batch(
            [f"{card['front']} {card['back']}" for card in batch]
        )
        
        # Batch Neo4j node creation
        await neo4j.bulk_create_card_nodes(card_ids, concepts_batch)
```

## Benefits of Anki Integration

**Enhanced Learning Experience:**
- **Visual Knowledge Map**: See how your cards connect conceptually
- **Learning Path Optimization**: Discover optimal study sequences
- **Knowledge Gap Detection**: Identify missing prerequisite concepts
- **Cross-Domain Connections**: Find unexpected relationships between subjects

**Data-Driven Insights:**
- **Concept Mastery Tracking**: Monitor understanding across related cards
- **Difficulty Pattern Analysis**: Identify challenging concept clusters
- **Review Optimization**: Focus on high-impact card relationships
- **Knowledge Graph Growth**: Watch your understanding network expand

This integration transforms Anki from individual flashcards into an intelligent, interconnected knowledge system that grows more valuable as you add content. 