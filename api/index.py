from fastapi import FastAPI
from mangum import Mangum
from app.api.chat import router as chat_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG Chatbot API",
    description="API for the RAG Chatbot application.",
    version="1.0.0",
)

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown.")

app.include_router(chat_router, prefix="/api")

handler = Mangum(app)
