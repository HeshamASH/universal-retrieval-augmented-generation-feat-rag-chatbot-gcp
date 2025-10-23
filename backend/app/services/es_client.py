from elasticsearch import AsyncElasticsearch
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

es_client: AsyncElasticsearch | None = None

def get_es_client() -> AsyncElasticsearch:
    """Returns the Elasticsearch client, initializing it if necessary."""
    global es_client
    if es_client is None:
        logger.info("Initializing Elasticsearch client...")
        try:
            if settings.ELASTIC_CLOUD_ID:
                es_client = AsyncElasticsearch(
                    cloud_id=settings.ELASTIC_CLOUD_ID,
                    api_key=settings.ELASTIC_API_KEY,
                    request_timeout=30,
                    max_retries=5,
                    retry_on_timeout=True
                )
                logger.info("Elasticsearch client initialized using Cloud ID.")
            elif settings.ELASTICSEARCH_URL:
                es_client = AsyncElasticsearch(
                    hosts=[settings.ELASTICSEARCH_URL],
                    request_timeout=30,
                    max_retries=5,
                    retry_on_timeout=True
                )
                logger.info("Elasticsearch client initialized using URL.")
            else:
                raise ValueError("Either ELASTIC_CLOUD_ID or ELASTICSEARCH_URL must be set.")
        except Exception as e:
            logger.error(f"Failed to initialize Elasticsearch client: {e}", exc_info=True)
            raise
    return es_client

async def close_es_client():
    """Closes the Elasticsearch client connection."""
    global es_client
    if es_client:
        await es_client.close()
        es_client = None
        logger.info("Elasticsearch client connection closed.")

# Initialize the client on module import
try:
    es_client = get_es_client()
except ValueError as e:
    logger.critical(f"Elasticsearch configuration error: {e}")
