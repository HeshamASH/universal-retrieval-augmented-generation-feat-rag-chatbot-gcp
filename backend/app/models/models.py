from pydantic import BaseModel, Field
from typing import Optional

class UploadResponse(BaseModel):
    """Response model for file upload."""
    file_name: str
    content_type: str
    message: str
    task_id: str

class QueryRequest(BaseModel):
    """Request model for a user query."""
    user_id: str = Field(..., description="The unique identifier for the user.")
    query_text: str = Field(..., description="The text of the user's query.")
    # session_id is removed as context is now persistent per user

class QueryResponse(BaseModel):
    """Response model for a user query."""
    answer: str
