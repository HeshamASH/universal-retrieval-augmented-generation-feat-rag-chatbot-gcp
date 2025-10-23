import google.generativeai as genai
from app.core.config import settings
import logging
import tiktoken

logger = logging.getLogger(__name__)

model = None
try:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    generation_config = genai.GenerationConfig(max_output_tokens=8192)
    safety_settings=[
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    ]
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL_NAME,
        generation_config=generation_config,
        safety_settings=safety_settings
    )
    logger.info(f"Gemini model '{settings.GEMINI_MODEL_NAME}' initialized.")
except Exception as e:
    logger.error(f"CRITICAL: Failed to initialize Gemini model: {e}", exc_info=True)

try:
    tokenizer = tiktoken.get_encoding("cl100k_base")
except Exception as e:
     logger.warning(f"Could not load tiktoken tokenizer: {e}. Context truncation might be less accurate.")
     tokenizer = None

def estimate_token_count(text: str) -> int:
    if not tokenizer or not text:
        return len(text.split())
    return len(tokenizer.encode(text))

ROUTER_PROMPT = '''Your job is to classify the user's intent based on their query. The two possible intents are "chit_chat" and "query_documents".

1.  **chit_chat**: The user is having a general conversation, asking a question not related to specific documents, or expressing a greeting.
    *   Examples: "Hello", "How are you?", "What's the weather like?", "Who won the world series?"

2.  **query_documents**: The user is asking a question that is expected to be answered from a specific set of documents.
    *   Examples: "What is the policy on remote work?", "Summarize the project proposal.", "Compare the results from the Q3 report to the Q4 report."

Respond with ONLY "chit_chat" or "query_documents".

User Query: "{query}"
Intent:'''

REWRITER_PROMPT = '''You are an expert query rewriter. Your task is to transform a user's conversational query into an optimized, keyword-rich query for a vector database search.

Focus on extracting key terms, concepts, and entities. Remove conversational filler.

User Query: "{query}"
Rewritten Query:'''

async def route_query(query: str) -> str:
    if not model:
        return "query_documents" # Default behavior if router fails
    try:
        prompt = ROUTER_PROMPT.format(query=query)
        response = await model.generate_content_async(prompt)
        intent = response.text.strip().lower()
        if "chit_chat" in intent:
            return "chit_chat"
        return "query_documents"
    except Exception as e:
        logger.error(f"Error routing query: {e}", exc_info=True)
        return "query_documents"

async def rewrite_query_for_search(query: str) -> str:
    if not model:
        return query # Return original query if rewriter fails
    try:
        prompt = REWRITER_PROMPT.format(query=query)
        response = await model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error rewriting query: {e}", exc_info=True)
        return query

ANSWER_GENERATOR_PROMPT_TEMPLATE = '''
You are an advanced AI assistant ('Big Brain') 🧠 for a RAG system. Your goal is to provide highly accurate and synthesized answers based *solely* on the provided context sections.

Objective: Carefully analyze the `[QUESTION]` and the `[CONTEXT]` snippets (which may include general knowledge from Elasticsearch and specific session content). Construct a comprehensive and coherent answer by synthesizing information *only* from the `[CONTEXT]`.

Critical Instructions:
1.  **Analyze Context Thoroughly:** Read all text snippets in `[CONTEXT]`. Prioritize relevance to the `[QUESTION]`.
2.  **Synthesize, Don't Just List:** Integrate relevant information from multiple snippets into a unified answer.
3.  **Absolute Grounding:** Base your *entire* response exclusively on the `[CONTEXT]`. NO external knowledge, NO assumptions, NO hallucinations. 🙅‍♂️🚫
4.  **Graceful Failure:** If `[CONTEXT]` (after potential truncation) lacks the necessary information to answer the `[QUESTION]`, respond *only* with: "I'm sorry, I couldn't find an answer to that in the provided documents."
5.  **Clarity and Conciseness:** Present the answer clearly and directly.
---
**Examples:**
*   **Example 1:**
    *   [CONTEXT]: "Document 1: The sky is blue due to Rayleigh scattering."
    *   [QUESTION]: "Why is the sky blue?"
    *   [ANSWER]: "Based on the provided document, the sky is blue because of a phenomenon called Rayleigh scattering."
*   **Example 2:**
    *   [CONTEXT]: "Document 1: The company's revenue in 2023 was $5 million. Document 2: The company's revenue in 2022 was $4 million."
    *   [QUESTION]: "What was the revenue in 2023?"
    *   [ANSWER]: "The company's revenue in 2023 was $5 million."
*   **Example 3:**
    *   [CONTEXT]: "Document 1: The project deadline is November 10th."
    *   [QUESTION]: "What is the capital of France?"
    *   [ANSWER]: "I'm sorry, I couldn't find an answer to that in the provided documents."
---
Current Task:

[CONTEXT]
{context_str}

[QUESTION]
{original_query}

[ANSWER]:'''

async def generate_final_answer(original_query: str, elastic_context: list[str], session_context: str | None) -> str:
    if not model:
        logger.error("Answer Generator: Gemini model not available.")
        return "Sorry, I encountered an error and cannot generate an answer right now."

    combined_context_parts = []
    if elastic_context:
        combined_context_parts.extend([f"Retrieved Document Snippet:\n{chunk}" for chunk in elastic_context])
    if session_context:
        combined_context_parts.append(f"User Provided Session Context:\n{session_context}")

    if not combined_context_parts:
        logger.info("Answer Generator: No context provided (neither Elastic nor session).")
        return "I'm sorry, I couldn't find an answer to that in the provided documents."

    RESERVED_TOKENS = 500
    MAX_EFFECTIVE_CONTEXT_TOKENS = settings.MAX_CONTEXT_TOKENS - RESERVED_TOKENS

    full_context_str = "\n\n---\n\n".join(combined_context_parts)
    estimated_tokens = estimate_token_count(full_context_str)
    final_context_str = full_context_str

    if estimated_tokens > MAX_EFFECTIVE_CONTEXT_TOKENS:
        logger.warning(f"Combined context ({estimated_tokens} tokens) exceeds limit ({MAX_EFFECTIVE_CONTEXT_TOKENS}). Truncating.")
        elastic_str = "\n\n---\n\n".join([f"Retrieved Document Snippet:\n{chunk}" for chunk in elastic_context])
        elastic_tokens = estimate_token_count(elastic_str)
        remaining_tokens = MAX_EFFECTIVE_CONTEXT_TOKENS - elastic_tokens

        if remaining_tokens > 100 and session_context:
            truncated_session_context = session_context[:int(remaining_tokens * 3)]
            if tokenizer:
                session_tokens = tokenizer.encode(session_context)
                truncated_session_context = tokenizer.decode(session_tokens[:remaining_tokens])

            final_context_str = elastic_str + f"\n\n---\n\nUser Provided Session Context (truncated):\n{truncated_session_context}..."
            logger.info("Truncated session context to fit within token limit.")
        else:
            final_context_str = elastic_str
            logger.warning("Session context dropped due to token limit after keeping Elastic context.")

    elif not combined_context_parts:
         final_context_str = "{empty}"

    prompt = ANSWER_GENERATOR_PROMPT_TEMPLATE.format(context_str=final_context_str, original_query=original_query)

    try:
        response = await model.generate_content_async(prompt)

        if not response.parts:
             logger.warning("Answer Generator received empty response parts, potentially blocked.")
             block_reason = getattr(getattr(response, 'prompt_feedback', None), 'block_reason', 'Unknown')
             return f"I cannot provide an answer. The request was blocked (Reason: {block_reason})."
        return response.text.strip()
    except Exception as e:
        logger.error(f"Error in generate_final_answer LLM call: {e}", exc_info=True)
        return "Sorry, I encountered an error while generating the answer."
