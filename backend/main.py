from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ingestion, chat
from app.services.es_client import close_es_client, get_es_client
import logging
import google.cloud.logging

# --- GCP Logging Integration ---
# It's important to set this up before initializing the FastAPI app
# if you want to capture startup logs correctly.
try:
    # This assumes the environment is authenticated. In Cloud Run, this is automatic.
    client = google.cloud.logging.Client()
    # Attaches a Google Cloud Logging handler to the root logger
    client.setup_logging()
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.info("Successfully configured Google Cloud Logging.")
except Exception as e:
    # Fallback to standard logging if GCP logging fails
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    logger.warning(f"Could not set up Google Cloud Logging: {e}. Falling back to standard logging.")


# --- Lifespan Events ---
async def startup_event():
    """Tasks to run on application startup."""
    logger.info("Application startup...")
    # Initialize Elasticsearch client
    try:
        get_es_client()
        logger.info("Elasticsearch client is ready.")
    except Exception as e:
        logger.critical(f"Failed to initialize Elasticsearch on startup: {e}", exc_info=True)
        # Depending on the desired behavior, you might want to prevent the app from starting.
        # For now, we log it as critical and let it continue.

async def shutdown_event():
    """Tasks to run on application shutdown."""
    logger.info("Application shutdown...")
    # Cleanly close the Elasticsearch client connection
    await close_es_client()


# --- FastAPI App Initialization ---
app = FastAPI(
    title="Multi-Tenant RAG API",
    description="An API for a multi-tenant RAG chatbot application using FastAPI, Elasticsearch, and Gemini.",
    version="1.0.0",
    lifespan=lambda app: (startup_event(), shutdown_event())
)


# --- CORS Middleware ---
# In a production environment, you should restrict the origins.
# Using a wildcard is suitable for development or if the API is public.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- API Routers ---
# Include the routers for different parts of the API.
app.include_router(ingestion.router, prefix="/api", tags=["Ingestion"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])


# --- Root Endpoint ---
@app.get("/", tags=["Root"])
async def read_root():
    """A simple health check endpoint."""
    return {"status": "ok", "message": "Welcome to the RAG API!"}
