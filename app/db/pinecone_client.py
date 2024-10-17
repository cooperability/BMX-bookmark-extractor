try:
    import pinecone
except ImportError:
    print("Pinecone client not found")
    pinecone = None
from app.core.config import settings
from app.core.logging import logger

from app.core.config import settings

def init_pinecone():
    if pinecone is None:
        print("Pinecone client not found")
        return None
    if not settings.PINECONE_API_KEY or not settings.PINECONE_ENV or not settings.PINECONE_INDEX_NAME:
        logger.error("Pinecone credentials not found")
        return None
    
    try:
        pinecone.init(api_key=settings.PINECONE_API_KEY, environment=settings.PINECONE_ENV)
        index = pinecone.Index(settings.PINECONE_INDEX_NAME)
        return index
    except Exception as e:
        logger.error(f"Failed to connect to Pinecone: {str(e)}")
        return None

pinecone_client = init_pinecone()

class PineconeClient:
    def __init__(self):
        self._index = None
        self.api_key = settings.PINECONE_API_KEY
        self.environment = settings.PINECONE_ENV
        self.index_name = settings.PINECONE_INDEX_NAME

    async def connect(self):
        try:
            pinecone.init(api_key=self.api_key, environment=self.environment)
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
    
    async def close(self):
        if self._index:
            self._index.close()
            logger.info("Pinecone connection closed")

pinecone_client = PineconeClient()