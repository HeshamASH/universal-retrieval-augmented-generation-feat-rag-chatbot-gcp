from app.services.es_client import es_client
from app.core.config import settings
from sentence_transformers import SentenceTransformer
import logging
from typing import List

logger = logging.getLogger(__name__)

# --- Embedding Model Loading ---
embedding_model_search = None
try:
    logger.info(f"Search Service: Loading embedding model: {settings.EMBEDDING_MODEL_NAME}")
    embedding_model_search = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    logger.info("Search Service: Embedding model loaded successfully.")
except Exception as e:
    logger.error(f"CRITICAL: Failed to load embedding model for search service: {e}", exc_info=True)


async def perform_hybrid_search(user_id: str, query_text: str, top_k: int = 5) -> List[str]:
    """
    Performs an asynchronous hybrid search (BM25 + Vector) in Elasticsearch,
    filtering by the user's ID AND including pre-loaded documents.
    """
    if not embedding_model_search:
        logger.error("Search Service: Embedding model not loaded. Cannot perform vector search.")
        return []
    if not query_text:
         logger.warning("Search Service: Received empty query text.")
         return []
    if not es_client:
         logger.error("Search Service: Elasticsearch client not available.")
         return []


    logger.debug(f"Performing hybrid search for user '{user_id}' (plus preloaded) with query: '{query_text}'")

    try:
        query_vector = embedding_model_search.encode(query_text).tolist()

        # --- Filter Logic: Include user's docs OR preloaded docs ---
        user_filter = {
            "bool": {
                "should": [
                    {"term": {"user_id": user_id}},
                    {"term": {"user_id": settings.PRELOADED_DOCS_USER_ID}}
                ],
                "minimum_should_match": 1 # Must match one of the user IDs
            }
        }

        query_body = {
            "size": top_k,
            "_source": ["chunk_text"],
            "query": {
                "bool": {
                    "filter": [user_filter], # Apply the combined user ID filter
                    "should": [
                        {
                            "match": {
                                "chunk_text": { "query": query_text, "boost": 0.3 }
                            }
                        }
                    ],
                    "minimum_should_match": 1
                }
            },
            "knn": {
                "field": "chunk_vector",
                "query_vector": query_vector,
                "k": top_k * 2, # Fetch more candidates initially across both user/preloaded
                "num_candidates": max(100, top_k * 10),
                "boost": 0.7,
                "filter": [user_filter] # Apply filter within KNN as well
            },
             # Use RRF for better merging of BM25 and kNN scores across potentially different score scales
             "rank": {
                 "rrf": {
                     "window_size": max(50, top_k * 5), # How many top results from each method to consider
                     "rank_constant": 60 # Standard default for RRF
                 }
             }
        }

        response = await es_client.search(
            index=settings.ES_INDEX_NAME,
            body=query_body,
            request_timeout=30
        )

        context_chunks = [hit["_source"]["chunk_text"] for hit in response.get("hits", {}).get("hits", []) if "_source" in hit and "chunk_text" in hit["_source"]]

        if not context_chunks:
             logger.info(f"Hybrid search returned no results for user '{user_id}' query '{query_text}'.")
        else:
             logger.info(f"Retrieved {len(context_chunks)} chunks for user '{user_id}' query '{query_text}'.")

        return context_chunks

    except ConnectionError as ce:
        logger.error(f"Search Service: Connection error during hybrid search: {ce}", exc_info=True)
        return []
    except Exception as e:
        logger.error(f"Search Service: Unexpected error during hybrid search: {e}", exc_info=True)
        return []
