// anki_importer.cypher
// -----------------------------------------------------------------------------
// IMPORTANT:
// 1. This script assumes you have pre-processed your Anki .txt files
//    (e.g., "Anthro (Psych_Soc_Econ_Health).txt") into a SINGLE CSV file
//    named 'anki_cards.csv'.
// 2. The CSV file MUST be placed in your Neo4j instance's 'import' directory.
//    For AuraDB, you might need to use a publicly accessible URL for the CSV
//    or upload it via other means if direct import directory access is restricted.
//    For local Neo4j, it's usually NEO4J_HOME/import.
// 3. The CSV file MUST have headers. Expected headers:
//    card_id, front, back, deck_name, tags
//    - card_id: Unique identifier for the card (e.g., the front content).
//    - front: The front content of the Anki card.
//    - back: The back content of the Anki card.
//    - deck_name: The name of the deck the card belongs to.
//    - tags: A semicolon-delimited string of tags (e.g., "tag1;tag2;another tag").
// -----------------------------------------------------------------------------

// Stage 1: Create Constraints
// Ensures card IDs are unique and tag names are unique for :AnkiTag nodes.
CREATE CONSTRAINT IF NOT EXISTS ankiCardIdConstraint FOR (c:AnkiCard) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS ankiTagNameConstraint FOR (t:AnkiTag) REQUIRE t.name IS UNIQUE;

// Stage 2: Load Anki Cards as Nodes
// This creates an :AnkiCard node for each row in the CSV.
LOAD CSV WITH HEADERS FROM 'file:///anki_cards.csv' AS row
FIELDTERMINATOR ',' // Specify comma as delimiter, adjust if your CSV uses something else
MERGE (card:AnkiCard {id: row.card_id})
ON CREATE SET
    card.front = row.front,
    card.back = row.back,
    card.deck = row.deck_name,
    // Store tags as a list property on the card node.
    // Handles cases where row.tags might be null or empty.
    card.tags = CASE WHEN row.tags IS NOT NULL AND trim(row.tags) <> "" THEN split(row.tags, ';') ELSE [] END;

// Stage 3: Create :AnkiTag Nodes and :HAS_TAG Relationships
// This creates distinct :AnkiTag nodes for each unique tag
// and links :AnkiCard nodes to their respective :AnkiTag nodes.
LOAD CSV WITH HEADERS FROM 'file:///anki_cards.csv' AS row
FIELDTERMINATOR ','
MATCH (card:AnkiCard {id: row.card_id})
// Process tags only if row.tags is not null and not empty
WITH card, row WHERE row.tags IS NOT NULL AND trim(row.tags) <> ""
UNWIND split(row.tags, ';') AS tagName
// Clean up tag name by trimming whitespace
WITH card, trim(tagName) AS cleanedTagName
WHERE cleanedTagName <> "" // Ensure tag name is not empty after trimming
MERGE (tagNode:AnkiTag {name: cleanedTagName})
MERGE (card)-[:HAS_TAG]->(tagNode);

// Stage 4: Create SHARES_DECK_WITH Relationships
// Connects all cards that belong to the same deck with each other.
MATCH (card1:AnkiCard), (card2:AnkiCard)
WHERE card1.deck = card2.deck AND id(card1) < id(card2) // Same deck, ensure pairs are unique and not self-loops
MERGE (card1)-[:SHARES_DECK_WITH]->(card2);

// Stage 5: Create SHARES_TAG_WITH Relationships
// Connects two cards if they share a specific tag.
// A separate relationship is created for each common tag between two cards.
MATCH (card1:AnkiCard)-[:HAS_TAG]->(tagNode:AnkiTag)<-[:HAS_TAG]-(card2:AnkiCard)
WHERE id(card1) < id(card2) // Ensure pairs are unique and not self-loops
MERGE (card1)-[:SHARES_TAG_WITH {tag: tagNode.name}]->(card2);

RETURN "Anki data import script stages complete. Check console for errors." AS status; 