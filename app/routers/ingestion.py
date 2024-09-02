from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings
from app.core.logging import logger
from app.services import pdf_service, web_service, youtube_service

router = APIRouter()

@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    try:
        result = await pdf_service.process_pdf(file)
        return {"message": "PDF ingested successfully", "result": result}
    except Exception as e:
        logger.error(f"PDF ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest/web")
async def ingest_web(url: str):
    try:
        result = await web_service.process_web_page(url)
        return {"message": "Web page ingested successfully", "result": result}
    except Exception as e:
        logger.error(f"Web page ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest/youtube")
async def ingest_youtube(video_id: str):
    try:
        result = await youtube_service.process_youtube_transcript(video_id)
        return {"message": "YouTube transcript ingested successfully", "result": result}
    except Exception as e:
        logger.error(f"YouTube transcript ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))