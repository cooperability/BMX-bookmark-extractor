from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "BMX"
    VERSION: str = "0.1.0"
    
    # FastAPI settings
    API_V1_STR: str = "/api/v1"
    
    # Neo4j settings
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str
    
    # Pinecone settings
    PINECONE_API_KEY: str
    PINECONE_ENV: str
    PINECONE_INDEX_NAME: str
    
    # Add more settings as needed

    class Config:
        env_file = ".env"

settings = Settings()