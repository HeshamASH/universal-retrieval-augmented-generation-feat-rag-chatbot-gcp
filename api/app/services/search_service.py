from sentence_transformers import SentenceTransformer
from app.core.config import settings
from app.services.es_client import get_es_client
import logging
from typing import List

logger = logging.getLogger(__name__)

embedding_model = None

def get_embedding_model() -> SentenceTransformer:
    """Initializes and returns a thread-safe SentenceTransformer model."""
    global embedding_model
    if embedding_model is None:
        try:
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME}")
            embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            logger.info("Embedding model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}", exc_info=True)
            raise
    return embedding_model

async def perform_hybrid_search(user_id: str, query: str) -> List[str]:
    """Performs a hybrid search (BM25 + kNN) in Elasticsearch."""
    try:
        es = get_es_client()
        model = get_embedding_model()
    except Exception as e:
        logger.error(f"Search prerequisites failed: {e}")
        return []

    try:
        query_vector = model.encode(query, convert_to_tensor=False).tolist()

        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "term": {
                                "user_id.keyword": user_id
                            }
                        }
                    ]
                }
            },
            "knn": {
                "field": "content_vector",
                "query_vector": query_vector,
                "k": 5,
                "num_candidates": 50
            },
            "rank": {
                "rrf": {}
            }
        }

        response = es.search(
            index=settings.ES_INDEX_NAME,
            body=search_body,
            size=5
        )

        return [hit["_source"]["content"] for hit in response["hits"]["hits"]]

    except Exception as e:
        logger.error(f"Error performing hybrid search: {e}", exc_info=True)
        return []
