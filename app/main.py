from fastapi import FastAPI
from app.db.neo4j_client import neo4j_client
from app.db.pinecone_client import pinecone_client
from app.core.config import settings
from app.core.logging import logger
from app.routers import ingestion, query

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "version": settings.VERSION}

@app.on_event("startup")
async def startup_event():
    if pinecone_client is not None and neo4j_client is not None:
        try:
            await neo4j_client.connect()
            await pinecone_client.connect()
            logger.info("All databases initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database connections: {str(e)}")
            raise

@app.on_event("shutdown")
async def shutdown_event():
    if pinecone_client is not None and neo4j_client is not None:
        await neo4j_client.close()
        await pinecone_client.close()
        logger.info("All databases closed successfully")

app.include_router(ingestion.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(query.router, prefix="/api/v1", tags=["query"])

@app.get("/health")
async def health_check():
    neo4j_status = "Connected" if neo4j_client else "Not connected"
    pinecone_status = "Connected" if pinecone_client else "Not connected"
    return {
        "status": "healthy",
        "neo4j": neo4j_status,
        "pinecone": pinecone_status
    }