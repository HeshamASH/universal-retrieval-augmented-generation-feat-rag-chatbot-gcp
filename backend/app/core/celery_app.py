from celery import Celery
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

logger.info(f"Initializing Celery with broker URL: {settings.REDIS_URL}")

try:
    celery = Celery(
        "tasks",
        broker=settings.REDIS_URL,
        backend=settings.REDIS_URL,
        include=["app.tasks.processing"] # Add all task modules here
    )

    celery.conf.update(
        task_acks_late=True,
        worker_prefetch_multiplier=1,
        task_serializer='json',
        result_serializer='json',
        accept_content=['json'],
        timezone='UTC',
        enable_utc=True,
    )
    logger.info("Celery application configured successfully.")

except Exception as e:
    logger.critical(f"Failed to initialize Celery: {e}", exc_info=True)
    # Raising the exception might prevent the application from starting,
    # which is desirable if Celery is critical.
    raise
