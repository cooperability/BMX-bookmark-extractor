from neo4j import GraphDatabase
from app.core.config import settings
from app.core.logging import logger

class Neo4jClientError(Exception):
    """Neo4j client error: Verbose error message"""
    pass

class Neo4jClient:
    def __init__(self):
        self._driver = None

    async def connect(self):
        try:
            self._driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            await self._driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {str(e)}")
            raise Neo4jClientError(f"Failed to connect to Neo4j: {str(e)}")

    async def close(self):
        if self._driver:
            await self._driver.close()
            logger.info("Neo4j connection closed")

    async def run_query(self, query, parameters=None):
        if not self._driver:
            raise Neo4jClientError("Neo4j client not connected")
        try:
            async with self._driver.session() as session:
                result = await session.run(query, parameters)
                return await result.data()
        except Exception as e:
            logger.error(f"Error executing Neo4j query: {str(e)}")
            raise Neo4jClientError(f"Neo4j query error: {str(e)}")

neo4j_client = Neo4jClient()