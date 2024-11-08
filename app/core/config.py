from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "BMX, Bookmark Extractor"
    VERSION: str = "0.1.0"
    
    # FastAPI settings
    API_V1_STR: str = "/api/v1"
    
    # Neo4j settings
    NEO4J_URI: Optional[str] = ''
    NEO4J_USER: Optional[str] = ''
    NEO4J_PASSWORD: Optional[str] = ''
    
    # Pinecone settings
    PINECONE_API_KEY: Optional[str] = ''
    PINECONE_ENV: Optional[str] = ''
    PINECONE_INDEX_NAME: Optional[str] = ''
    
    class Config:
        env_file = ".env"

settings = Settings()