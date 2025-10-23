from fastapi import APIRouter, UploadFile, File, HTTPException, Form, status
from app.models.models import UploadResponse
from app.tasks.processing import process_document
from app.core.config import settings
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_FILE_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
    "text/markdown": ".md"
}

@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Accepts a file upload, saves it temporarily, and queues it for processing.
    """
    logger.info(f"Received file upload '{file.filename}' for user '{user_id}'.")

    if file.content_type not in SUPPORTED_FILE_TYPES:
        logger.warning(f"Unsupported file type '{file.content_type}' for file '{file.filename}'.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Supported types are: PDF, DOCX, TXT, MD."
        )

    try:
        # Ensure the temporary upload directory exists
        temp_dir = Path(settings.TEMP_UPLOAD_DIR)
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Create a safe filename and path
        file_extension = SUPPORTED_FILE_TYPES[file.content_type]
        # Using a simple approach for filename, but a more robust unique name generator
        # (like UUID) would be better in a high-concurrency environment.
        safe_filename = f"{user_id}_{Path(file.filename).stem}_{Path(file.filename).suffix}"
        temp_file_path = temp_dir / safe_filename

        # Save the file to the temporary location
        with open(temp_file_path, "wb") as buffer:
            buffer.write(await file.read())

        logger.info(f"File '{file.filename}' saved temporarily to '{temp_file_path}'.")

        # --- Queue the processing task with Celery ---
        # The task will handle parsing, embedding, and indexing.
        task = process_document.delay(str(temp_file_path), user_id, file.filename)
        logger.info(f"Queued document processing task with ID: {task.id}")

        return UploadResponse(
            file_name=file.filename,
            content_type=file.content_type,
            message="File uploaded and queued for processing.",
            task_id=task.id
        )

    except Exception as e:
        logger.error(f"Error during file upload for user '{user_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during file upload."
        )
