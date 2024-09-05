from app.database.neo4j_connection import neo4j_connection
import logging

logger = logging.getLogger(__name__)

def create_schema():
    queries = [
        """
        CREATE CONSTRAINT unique_document IF NOT EXISTS
        FOR (d:Document) REQUIRE d.id IS UNIQUE
        """,
        """
        CREATE CONSTRAINT unique_entity IF NOT EXISTS
        FOR (e:Entity) REQUIRE e.name IS UNIQUE
        """,
        """
        CREATE INDEX document_title IF NOT EXISTS
        FOR (d:Document) ON (d.title)
        """,
        """
        CREATE INDEX entity_type IF NOT EXISTS
        FOR (e:Entity) ON (e.type)
        """
    ]
    
    for query in queries:
        try:
            neo4j_connection.run_query(query)
            logger.info(f"Successfully executed schema query: {query[:50]}...")
        except Exception as e:
            logger.error(f"Error creating schema: {str(e)}")
            raise

def create_document_node(id, title, content, source_type):
    query = """
    CREATE (d:Document {
        id: $id,
        title: $title,
        content: $content,
        source_type: $source_type,
        created_at: datetime()
    })
    RETURN d
    """
    parameters = {
        "id": id,
        "title": title,
        "content": content,
        "source_type": source_type
    }
    try:
        result = neo4j_connection.run_query(query, parameters)
        logger.info(f"Created document node with id: {id}")
        return result
    except Exception as e:
        logger.error(f"Error creating document node: {str(e)}")
        raise

def create_entity_node(name, entity_type):
    query = """
    MERGE (e:Entity {name: $name, type: $entity_type})
    RETURN e
    """
    parameters = {"name": name, "entity_type": entity_type}
    try:
        result = neo4j_connection.run_query(query, parameters)
        logger.info(f"Created or merged entity node: {name}")
        return result
    except Exception as e:
        logger.error(f"Error creating entity node: {str(e)}")
        raise

def create_relationship(document_id, entity_name, relationship_type):
    query = """
    MATCH (d:Document {id: $document_id})
    MATCH (e:Entity {name: $entity_name})
    MERGE (d)-[r:MENTIONS {type: $relationship_type}]->(e)
    RETURN r
    """
    parameters = {
        "document_id": document_id,
        "entity_name": entity_name,
        "relationship_type": relationship_type
    }
    try:
        result = neo4j_connection.run_query(query, parameters)
        logger.info(f"Created relationship between document {document_id} and entity {entity_name}")
        return result
    except Exception as e:
        logger.error(f"Error creating relationship: {str(e)}")
        raise