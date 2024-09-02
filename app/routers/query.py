from fastapi import APIRouter, HTTPException
from app.core.logging import logger
from app.services import query_service

router = APIRouter()

@router.get("/query")
async def query_corpus(query: str):
    try:
        result = await query_service.process_query(query)
        return {"result": result}
    except Exception as e:
        logger.error(f"Query processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))