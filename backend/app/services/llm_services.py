import google.generativeai as genai
from app.core.config import settings
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# --- Gemini Client Initialization ---
try:
    if "MISSING" not in settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        logger.info("Google Generative AI client configured.")
    else:
        logger.critical("GEMINI_API_KEY is missing. LLM services will not function.")
except Exception as e:
    logger.error(f"Error configuring Google Generative AI client: {e}", exc_info=True)

async def route_query(query: str) -> str:
    """
    Uses the LLM to classify the user's query.
    Returns 'chit_chat' or 'query_documents'.
    """
    logger.debug(f"Routing query: '{query[:50]}...'")
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
        prompt = f"""
        You are a query router. Your task is to classify the user's query into one of two categories:
        1.  'chit_chat': For conversational greetings, simple questions, or off-topic remarks.
        2.  'query_documents': For questions that require information from a knowledge base or specific documents.

        Analyze the following user query and return ONLY the category name ('chit_chat' or 'query_documents').

        Examples:
        -   Query: "hello there" -> chit_chat
        -   Query: "how are you?" -> chit_chat
        -   Query: "what is the refund policy?" -> query_documents
        -   Query: "summarize the privacy agreement" -> query_documents
        -   Query: "what's the weather like?" -> chit_chat

        User Query: "{query}"
        Category:
        """
        response = await model.generate_content_async(prompt)
        intent = response.text.strip().lower()
        if intent not in ['chit_chat', 'query_documents']:
            logger.warning(f"Router returned unexpected intent '{intent}'. Defaulting to 'query_documents'.")
            return 'query_documents'
        return intent
    except Exception as e:
        logger.error(f"Error in route_query: {e}", exc_info=True)
        # Default to the safer option of searching documents if routing fails.
        return 'query_documents'


async def rewrite_query_for_search(query: str) -> str:
    """
    Uses the LLM to rewrite the user's query for better search results.
    """
    logger.debug(f"Rewriting query: '{query[:50]}...'")
    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
        prompt = f"""
        You are a search query optimization expert. Your task is to rewrite the user's query to be more effective for a vector and keyword-based search engine.
        Focus on extracting key terms, removing conversational fluff, and structuring it as a concise, keyword-rich query.

        -   Do not answer the question.
        -   Do not add any preamble like "Here is the rewritten query:".
        -   Return only the optimized query text.

        Examples:
        -   Original: "Hey, can you tell me what the policy is for getting my money back?"
        -   Rewritten: "refund policy details money back"
        -   Original: "I need to know everything about data privacy."
        -   Rewritten: "data privacy policy summary"

        Original Query: "{query}"
        Rewritten Query:
        """
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error in rewrite_query_for_search: {e}", exc_info=True)
        # If rewriting fails, use the original query as a fallback.
        return query


def truncate_context(context_chunks: List[str], max_tokens: int) -> str:
    """
    Truncates a list of context strings to fit within a maximum token limit.
    A very rough approximation: 1 token ~= 4 characters.
    """
    max_chars = max_tokens * 3.5 # A slightly more conservative estimate
    total_chars = 0
    truncated_context = []
    for chunk in context_chunks:
        if total_chars + len(chunk) > max_chars:
            remaining_chars = int(max_chars - total_chars)
            if remaining_chars > 0:
                truncated_context.append(chunk[:remaining_chars] + "...")
            break
        truncated_context.append(chunk)
        total_chars += len(chunk)

    if len(truncated_context) < len(context_chunks):
        logger.warning(f"Context truncated from {len(context_chunks)} chunks to {len(truncated_context)} to fit token limit.")

    return "\n---\n".join(truncated_context)


async def generate_final_answer(original_query: str, elastic_context: List[str], session_context: Optional[str]) -> str:
    """
    Uses the LLM to generate a final, grounded answer based on the retrieved context.
    """
    logger.debug(f"Generating final answer for query: '{original_query[:50]}...'")

    # Combine and truncate context if necessary
    combined_context = truncate_context(elastic_context, settings.MAX_CONTEXT_TOKENS)

    if not combined_context:
        # Handle cases where no context was found
        logger.info("No context found. Generating a 'not found' response.")
        prompt = f"""
        You are a helpful AI assistant. The user asked a question, but you could not find any relevant information in the provided documents.
        Politely inform the user that you couldn't find an answer in their documents and suggest they rephrase the question or upload more documents.
        Do not make up an answer.

        User's Question: "{original_query}"

        Your polite response:
        """
    else:
        # Main prompt for generating a grounded answer
        prompt = f"""
        You are a helpful AI assistant. Your task is to answer the user's question based *only* on the provided context.
        -   If the context contains the answer, synthesize it into a clear and concise response.
        -   If the context does not contain the answer, state that you could not find the information in the provided documents.
        -   Do not use any external knowledge or make up information.
        -   Cite the source of your information if possible (though not required for this implementation).

        --- CONTEXT ---
        {combined_context}
        --- END CONTEXT ---

        User's Question: "{original_query}"

        Answer:
        """

    try:
        model = genai.GenerativeModel(settings.GEMINI_MODEL_NAME)
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error in generate_final_answer: {e}", exc_info=True)
        return "I'm sorry, but I encountered an error while trying to generate a response. Please try again."
