from fastapi import APIRouter, HTTPException, status
import logging
from app.models.models import QueryRequest, QueryResponse
from app.services.llm_services import (
    route_query,
    rewrite_query_for_search,
    generate_final_answer
)
from app.services.search_service import perform_hybrid_search

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/query", response_model=QueryResponse)
async def handle_rag_query(request: QueryRequest):
    """
    Handles user queries using the 4-component RAG pipeline,
    incorporating optional session context from the request.
    """
    logger.info(f"Received query from user '{request.user_id}': '{request.query_text[:50]}...'")
    if request.session_context_text:
        logger.info(f"  Including session context (first 100 chars): '{request.session_context_text[:100]}...'")

    if not request.query_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Query text cannot be empty.")

    try:
        # --- Component 1: Route Query ---
        intent = await route_query(request.query_text)
        logger.debug(f"Query intent classified as: {intent}")

        if intent == "chit_chat":
            logger.info("Handling as chit-chat.")
            answer = await generate_final_answer(request.query_text, elastic_context=[], session_context=None)
            return QueryResponse(answer=answer)

        # --- RAG Pipeline for "query_documents" ---
        logger.info("Handling as document query.")

        # --- Component 2: Rewrite Query ---
        rewritten_query = await rewrite_query_for_search(request.query_text)
        logger.debug(f"Rewritten query for search: '{rewritten_query}'")

        # --- Component 3: Database Search (Elastic Cloud Hybrid) ---
        elastic_context_chunks = await perform_hybrid_search(request.user_id, rewritten_query)
        if not elastic_context_chunks:
            logger.info("No relevant context found in pre-loaded documents (Elasticsearch).")

        # --- Component 4: Generate Final Answer (with combined context) ---
        final_answer = await generate_final_answer(
            original_query=request.query_text,
            elastic_context=elastic_context_chunks,
            session_context=request.session_context_text
        )
        logger.info(f"Generated final answer for user '{request.user_id}'.")

        return QueryResponse(answer=final_answer)

    except HTTPException as http_exc:
         raise http_exc
    except Exception as e:
        logger.error(f"Error processing query for user '{request.user_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing your query."
        )
