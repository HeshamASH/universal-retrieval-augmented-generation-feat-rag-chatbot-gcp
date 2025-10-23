import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from pathlib import Path
import logging
import warnings

# --- Environment Loading ---
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)
logger = logging.getLogger(__name__)

# --- Optional: Secret Manager Client ---
# Initialize client only if needed and library is installed
secret_manager_client = None
try:
    from google.cloud import secretmanager
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("GOOGLE_CLOUD_PROJECT"):
        secret_manager_client = secretmanager.SecretManagerServiceClient()
        logger.info("Google Secret Manager client initialized.")
    else:
        logger.warning("GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_PROJECT not set. Cannot initialize Secret Manager.")
except ImportError:
    logger.info("google-cloud-secret-manager not installed. Secrets must be provided directly via environment variables.")
except Exception as e_sm:
    logger.error(f"Error initializing Secret Manager client: {e_sm}")

def get_secret(secret_name_env_var: str) -> str | None:
    """Fetches secret from GCP Secret Manager if configured, otherwise returns None."""
    secret_resource_name = os.getenv(secret_name_env_var)
    if secret_manager_client and secret_resource_name:
        try:
            logger.info(f"Fetching secret: {secret_resource_name}")
            response = secret_manager_client.access_secret_version(name=secret_resource_name)
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.error(f"Failed to fetch secret '{secret_resource_name}': {e}", exc_info=True)
            return None
    elif secret_resource_name:
         logger.warning(f"Secret name {secret_name_env_var} is set, but Secret Manager client is not available.")
    return None

class Settings(BaseSettings):
    # --- Secrets ---
    # Attempt to fetch from Secret Manager first, fallback to direct env var
    _gemini_api_key_secret: str | None = get_secret("GOOGLE_API_KEY_SECRET_NAME")
    GEMINI_API_KEY: str = _gemini_api_key_secret or os.getenv("GOOGLE_API_KEY", "GEMINI_KEY_MISSING")

    _elastic_api_key_secret: str | None = get_secret("ELASTIC_API_KEY_SECRET_NAME")
    ELASTIC_API_KEY: str | None = _elastic_api_key_secret or os.getenv("ELASTIC_API_KEY")

    # --- Direct Config ---
    ELASTIC_CLOUD_ID: str | None = os.getenv("ELASTIC_CLOUD_ID")
    ELASTICSEARCH_URL: str | None = os.getenv("ELASTICSEARCH_URL") # Fallback

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis_rag:6379/0") # MUST override in GCP

    # --- Model & Index Config ---
    EMBEDDING_MODEL_NAME: str = 'sentence-transformers/all-MiniLM-L6-v2'
    EMBEDDING_DIM: int = 384
    GEMINI_MODEL_NAME: str = os.getenv("GEMINI_MODEL_NAME","gemini-2.5-flash-lite-preview-09-2025")
    MAX_CONTEXT_TOKENS: int = int(os.getenv("MAX_CONTEXT_TOKENS", "8000"))
    ES_INDEX_NAME: str = os.getenv("ES_INDEX_NAME", "rag_documents")
    PRELOADED_DOCS_USER_ID: str = os.getenv("PRELOADED_DOCS_USER_ID", "_preloaded_") # ID for general docs

    # --- File Handling ---
    TEMP_UPLOAD_DIR: str = os.getenv("TEMP_UPLOAD_DIR", "/tmp/uploads") # Use /tmp in Cloud Run

    class Config:
        case_sensitive = True
        # env_file = '.env' # .env is loaded manually above
        # env_file_encoding = 'utf-8'

settings = Settings()

# --- Post-Initialization Validation/Warnings ---
if "MISSING" in settings.GEMINI_API_KEY:
    logger.critical("CRITICAL: GEMINI_API_KEY is missing or invalid!")
if not settings.ELASTIC_CLOUD_ID or not settings.ELASTIC_API_KEY:
    if not settings.ELASTICSEARCH_URL:
        logger.critical("CRITICAL: Elasticsearch connection details (Cloud ID & API Key, or URL) are missing!")
if "localhost" in settings.REDIS_URL or "redis_rag" in settings.REDIS_URL:
     warnings.warn("REDIS_URL is using a default/Docker value. Ensure it's correctly set to your Memorystore Private IP in the GCP environment.", RuntimeWarning)
     logger.warning("REDIS_URL is using a default/Docker value. Ensure it points to Memorystore Private IP in GCP.")

# Ensure temp directory exists
try:
    Path(settings.TEMP_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
except Exception as e_mkdir:
     logger.warning(f"Could not create temp directory {settings.TEMP_UPLOAD_DIR}: {e_mkdir}. Assuming /tmp exists.")
