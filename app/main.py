from fastapi import FastAPI
from app.db.neo4j_client import neo4j_client
from app.db.pinecone_client import pinecone_client
from app.core.config import settings
from app.core.logging import logger
from app.routers import ingestion, query

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

@app.on_event("startup")
async def startup_event():
    try:
        await neo4j_client.connect()
        await pinecone_client.connect()
        logger.info("All databases initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database connections: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    await neo4j_client.close()
    await pinecone_client.close()
    logger.info("All databases closed successfully")

app.include_router(ingestion.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(query.router, prefix="/api/v1", tags=["query"])

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "version": settings.VERSION}

@app.get("/health")
async def health_check():
    try:
        # Check Neo4j connection
        await neo4j_client.run_query("RETURN 1")
        
        # Check Pinecone connection
        await pinecone_client.query([0.1] * 8, top_k=1)  # Assuming 8-dimensional vectors, adjust as needed
        
        return {
            "status": "healthy",
            "neo4j": "connected",
            "pinecone": "connected",
            "version": settings.VERSION
        }
    except Neo4jClientError:
        logger.error("Neo4j health check failed")
        return {"status": "unhealthy", "neo4j": "disconnected", "pinecone": "unknown"}
    except Exception as e:
        logger.error(f"Pinecone health check failed: {str(e)}")
        return {"status": "unhealthy", "neo4j": "connected", "pinecone": "disconnected"}