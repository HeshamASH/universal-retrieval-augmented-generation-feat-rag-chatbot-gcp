from elasticsearch import Elasticsearch
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

es_client: Elasticsearch | None = None

def get_es_client() -> Elasticsearch:
    """Initializes and returns a thread-safe Elasticsearch client."""
    global es_client
    if es_client is None:
        try:
            logger.info("Initializing Elasticsearch client...")
            if settings.ELASTIC_CLOUD_ID and settings.ELASTIC_API_KEY:
                logger.info(f"Connecting to Elastic Cloud: {settings.ELASTIC_CLOUD_ID}")
                es_client = Elasticsearch(
                    cloud_id=settings.ELASTIC_CLOUD_ID,
                    api_key=settings.ELASTIC_API_KEY,
                    request_timeout=30,
                    max_retries=5,
                    retry_on_timeout=True
                )
            elif settings.ELASTICSEARCH_URL:
                logger.info(f"Connecting to Elasticsearch URL: {settings.ELASTICSEARCH_URL}")
                es_client = Elasticsearch(
                    hosts=[settings.ELASTICSEARCH_URL],
                    request_timeout=30,
                    max_retries=5,
                    retry_on_timeout=True
                )
            else:
                raise ValueError("Elasticsearch connection details not configured.")

            if es_client.ping():
                logger.info("Successfully connected to Elasticsearch.")
            else:
                logger.error("Could not connect to Elasticsearch.")
                raise ConnectionError("Elasticsearch ping failed.")

        except Exception as e:
            logger.error(f"Failed to initialize Elasticsearch client: {e}", exc_info=True)
            es_client = None # Ensure client is not used if initialization fails
            raise
    return es_client
