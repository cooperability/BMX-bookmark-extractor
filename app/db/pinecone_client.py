import pinecone
from app.core.config import settings
from app.core.logging import logger

class PineconeClient:
    def __init__(self):
        self._index = None

    async def connect(self):
        try:
            pinecone.init(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENV)
            self._index = pinecone.Index(settings.PINECONE_INDEX_NAME)
            logger.info("Connected to Pinecone successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Pinecone: {str(e)}")
            raise

    async def upsert(self, vectors):
        if not self._index:
            raise Exception("Pinecone client not connected")
        return self._index.upsert(vectors=vectors)

    async def query(self, vector, top_k=10):
        if not self._index:
            raise Exception("Pinecone client not connected")
        return self._index.query(vector=vector, top_k=top_k)

pinecone_client = PineconeClient()