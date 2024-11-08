from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError
from app.core.config import settings
from app.core.logging import logger
from dotenv import load_dotenv
import os
import logging
import uuid

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_neo4j():
    if not settings.NEO4J_URI or not settings.NEO4J_USER or not settings.NEO4J_PASSWORD:
        logger.warning("Neo4j settings not configured")
        return None
    
    try:
        driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
        # Test the connection
        with driver.session() as session:
            session.run("RETURN 1")
        logger.info("Successfully connected to Neo4j database")
        return driver
    except Exception as e:
        logger.error(f"Failed to connect to Neo4j: {str(e)}")
        return None

neo4j_client = init_neo4j()

def get_neo4j_session():
    if neo4j_client is None:
        raise Exception("Neo4j client not initialized")
    return neo4j_client.session()

class Neo4jConnection:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USER")
        password = os.getenv("NEO4J_PASSWORD")
        
        if not all([uri, user, password]):
            raise ValueError("Neo4j connection details are missing in the .env file")
        
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            logger.info("Successfully connected to Neo4j database")
        except (ServiceUnavailable, AuthError) as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            raise

    def close(self):
        if self.driver:
            self.driver.close()
            logger.info("Neo4j connection closed")

    def run_query(self, query, parameters=None):
        try:
            with self.driver.session() as session:
                result = session.run(query, parameters)
                return list(result)
        except Exception as e:
            logger.error(f"Error executing Neo4j query: {str(e)}")
            raise

    def create_document_node(self, title, content, source_type):
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
            "id": str(uuid.uuid4()),
            "title": title,
            "content": content,
            "source_type": source_type
        }
        try:
            result = self.run_query(query, parameters)
            logger.info(f"Created document node with title: {title}")
            return result[0]['d']
        except Exception as e:
            logger.error(f"Error creating document node: {str(e)}")
            raise

    def create_entity_node(self, name, entity_type):
        query = """
        MERGE (e:Entity {name: $name, type: $entity_type})
        RETURN e
        """
        parameters = {"name": name, "entity_type": entity_type}
        try:
            result = self.run_query(query, parameters)
            logger.info(f"Created or merged entity node: {name}")
            return result[0]['e']
        except Exception as e:
            logger.error(f"Error creating entity node: {str(e)}")
            raise

    def create_relationship(self, document_id, entity_name, relationship_type):
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
            result = self.run_query(query, parameters)
            logger.info(f"Created relationship between document {document_id} and entity {entity_name}")
            return result[0]['r']
        except Exception as e:
            logger.error(f"Error creating relationship: {str(e)}")
            raise

try:
    neo4j_client = Neo4jConnection()
except Exception as e:
    logger.critical(f"Failed to initialize Neo4j connection: {str(e)}")
    raise