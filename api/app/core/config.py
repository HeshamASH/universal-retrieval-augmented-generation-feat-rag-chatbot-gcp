import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path
import logging

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GOOGLE_API_KEY", "YOUR_GEMINI_API_KEY_MISSING")
    ELASTIC_CLOUD_ID: str | None = os.getenv("ELASTIC_CLOUD_ID")
    ELASTIC_API_KEY: str | None = os.getenv("ELASTIC_API_KEY")
    ELASTICSEARCH_URL: str | None = os.getenv("ELASTICSEARCH_URL") # Fallback

    # Embedding Model Settings
    EMBEDDING_MODEL_NAME: str = 'sentence-transformers/all-MiniLM-L6-v2'
    EMBEDDING_DIM: int = 384

    # LLM Settings
    GEMINI_MODEL_NAME: str = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash-lite-preview-09-2025")
    # Practical token limit for combined context sent to LLM Answer Generator
    MAX_CONTEXT_TOKENS: int = int(os.getenv("MAX_CONTEXT_TOKENS", "8000"))

    # Index Settings
    ES_INDEX_NAME: str = os.getenv("ES_INDEX_NAME", "rag_documents")

    class Config:
        case_sensitive = True
        env_file = '.env'
        env_file_encoding = 'utf-8'

settings = Settings()

if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_MISSING":
    logger.warning("GEMINI_API_KEY is not set in the environment.")

if not settings.ELASTIC_CLOUD_ID and not settings.ELASTICSEARCH_URL:
    logger.warning("Neither ELASTIC_CLOUD_ID nor ELASTICSEARCH_URL is set. Elasticsearch connection will fail.")
elif settings.ELASTIC_CLOUD_ID and not settings.ELASTIC_API_KEY:
    logger.warning("ELASTIC_CLOUD_ID is set, but ELASTIC_API_KEY is missing.")
