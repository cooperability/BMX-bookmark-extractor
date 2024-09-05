from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings
from app.core.logging import logger
from app.services import pdf_service, web_service, youtube_service
from app.db.neo4j_client import neo4j_client
from app.services.entity_extraction import extract_entities

router = APIRouter()

@router.post("/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    try:
        content = await pdf_service.process_pdf(file)
        document = neo4j_client.create_document_node(file.filename, content, "PDF")
        entities = extract_entities(content)
        for entity in entities:
            neo4j_client.create_entity_node(entity['name'], entity['type'])
            neo4j_client.create_relationship(document['id'], entity['name'], 'MENTIONS')
        return {"message": "PDF ingested successfully", "document_id": document['id'], "entities": entities}
    except Exception as e:
        logger.error(f"PDF ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest/web")
async def ingest_web(url: str):
    try:
        content = await web_service.process_web_page(url)
        document = neo4j_client.create_document_node(url, content, "WEB")
        entities = extract_entities(content)
        for entity in entities:
            neo4j_client.create_entity_node(entity['name'], entity['type'])
            neo4j_client.create_relationship(document['id'], entity['name'], 'MENTIONS')
        return {"message": "Web page ingested successfully", "document_id": document['id'], "entities": entities}
    except Exception as e:
        logger.error(f"Web page ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ingest/youtube")
async def ingest_youtube(video_id: str):
    try:
        content = await youtube_service.process_youtube_transcript(video_id)
        document = neo4j_client.create_document_node(f"YouTube: {video_id}", content, "YOUTUBE")
        entities = extract_entities(content)
        for entity in entities:
            neo4j_client.create_entity_node(entity['name'], entity['type'])
            neo4j_client.create_relationship(document['id'], entity['name'], 'MENTIONS')
        return {"message": "YouTube transcript ingested successfully", "document_id": document['id'], "entities": entities}
    except Exception as e:
        logger.error(f"YouTube transcript ingestion failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract_entities")
async def extract_entities_endpoint(text: str):
    try:
        entities = extract_entities(text)
        return {"entities": entities}
    except Exception as e:
        logger.error(f"Entity extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))