from app.core.celery_app import celery
from app.core.config import settings
from app.services.es_client import get_es_client
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
from elasticsearch.helpers import async_bulk
import logging
import pypdf2
import docx
from pathlib import Path
import asyncio

logger = logging.getLogger(__name__)

# --- Embedding Model Loading ---
# Load the model once when the worker starts.
embedding_model = None
try:
    logger.info(f"Worker: Loading embedding model: {settings.EMBEDDING_MODEL_NAME}")
    embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    logger.info("Worker: Embedding model loaded successfully.")
except Exception as e:
    logger.error(f"CRITICAL: Failed to load embedding model in worker: {e}", exc_info=True)
    # The worker will not be able to process tasks without the model.
    # Depending on the setup, this might cause the worker to fail to start.

def parse_file(file_path: str) -> str:
    """Parses the content of a file based on its extension."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found at path: {file_path}")

    logger.info(f"Parsing file: {file_path}")
    content = ""
    try:
        if path.suffix == ".pdf":
            with open(file_path, "rb") as f:
                reader = pypdf2.PdfReader(f)
                for page in reader.pages:
                    content += page.extract_text() or ""
        elif path.suffix == ".docx":
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                content += para.text + "\n"
        elif path.suffix in [".txt", ".md"]:
            content = path.read_text(encoding="utf-8")
        else:
            raise ValueError(f"Unsupported file type: {path.suffix}")
        logger.info(f"Successfully parsed {len(content)} characters from {file_path}")
        return content
    except Exception as e:
        logger.error(f"Error parsing file {file_path}: {e}", exc_info=True)
        raise

async def create_index_if_not_exists():
    """Creates the Elasticsearch index with the correct mapping if it doesn't exist."""
    es_client = get_es_client()
    try:
        if not await es_client.indices.exists(index=settings.ES_INDEX_NAME):
            logger.info(f"Index '{settings.ES_INDEX_NAME}' not found. Creating new index.")
            mapping = {
                "properties": {
                    "user_id": {"type": "keyword"},
                    "file_name": {"type": "keyword"},
                    "chunk_text": {"type": "text"},
                    "chunk_vector": {
                        "type": "dense_vector",
                        "dims": settings.EMBEDDING_DIM
                    }
                }
            }
            await es_client.indices.create(index=settings.ES_INDEX_NAME, mappings=mapping)
            logger.info(f"Successfully created index '{settings.ES_INDEX_NAME}'.")
    except Exception as e:
        logger.error(f"Error during index creation check: {e}", exc_info=True)
        # It's critical to know if the index is missing or couldn't be created.
        raise


@celery.task(name="tasks.process_document", autoretry_for=(Exception,), retry_kwargs={'max_retries': 3, 'countdown': 5})
def process_document(file_path: str, user_id: str, file_name: str):
    """
    Celery task to parse, chunk, embed, and index a document.
    This is a synchronous wrapper for the main async processing logic.
    """
    if not embedding_model:
        logger.error("Embedding model not loaded, cannot process document. Failing task.")
        # This will cause the task to be retried, giving the model time to load if it's a transient issue.
        raise RuntimeError("Embedding model is not available.")
    try:
        # Run the async processing function within the sync celery task
        return asyncio.run(process_document_async(file_path, user_id, file_name))
    except Exception as e:
        logger.error(f"Unhandled exception in process_document for {file_path}: {e}", exc_info=True)
        # Clean up the temporary file on failure to prevent disk space issues.
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception as e_clean:
            logger.error(f"Failed to cleanup temp file {file_path}: {e_clean}")
        raise # Re-raise to let Celery handle the retry/failure.

async def process_document_async(file_path: str, user_id: str, file_name: str):
    """
    The core asynchronous logic for document processing.
    """
    logger.info(f"Starting async processing for file: {file_name}, user: {user_id}")
    es_client = get_es_client()

    try:
        await create_index_if_not_exists()

        # 1. Parse File Content
        document_text = parse_file(file_path)
        if not document_text.strip():
            logger.warning(f"Document {file_name} is empty or could not be parsed. Skipping.")
            return {"status": "skipped", "reason": "empty content"}

        # 2. Chunk Text
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150
        )
        chunks = text_splitter.split_text(document_text)
        logger.info(f"Split document into {len(chunks)} chunks.")

        # 3. Generate Embeddings
        embeddings = embedding_model.encode(chunks, show_progress_bar=False).tolist()

        # 4. Prepare for Bulk Indexing
        actions = []
        for i, chunk in enumerate(chunks):
            action = {
                "_index": settings.ES_INDEX_NAME,
                "_source": {
                    "user_id": user_id,
                    "file_name": file_name,
                    "chunk_text": chunk,
                    "chunk_vector": embeddings[i],
                }
            }
            actions.append(action)

        # 5. Perform Async Bulk Indexing
        if actions:
            logger.info(f"Bulk indexing {len(actions)} documents...")
            success, failed = await async_bulk(es_client, actions, raise_on_error=False, raise_on_exception=False)
            logger.info(f"Bulk indexing complete. Success: {success}, Failed: {len(failed)}")
            if failed:
                logger.error(f"Failed to index {len(failed)} documents. Example error: {failed[0]}")
                # Depending on requirements, you might want to raise an exception here
                # to trigger a retry of the whole task.
                # For now, we log the error and continue.

        return {"status": "success", "indexed_chunks": len(actions)}

    except Exception as e:
        logger.error(f"Error during async processing of {file_name} for user {user_id}: {e}", exc_info=True)
        raise # Re-raise to be caught by the sync wrapper for Celery retry.
    finally:
        # 6. Cleanup
        try:
            Path(file_path).unlink(missing_ok=True)
            logger.info(f"Successfully cleaned up temporary file: {file_path}")
        except Exception as e_clean:
            logger.error(f"Failed to cleanup temp file {file_path}: {e_clean}")
