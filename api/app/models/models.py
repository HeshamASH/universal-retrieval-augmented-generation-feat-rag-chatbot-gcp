from pydantic import BaseModel, Field
from typing import List, Optional

class QueryRequest(BaseModel):
    user_id: str = Field(..., description="Unique identifier for the user.")
    query_text: str = Field(..., description="The user's question or message.")
    session_context_text: Optional[str] = Field(None, description="Text extracted from a user-uploaded file for the current session.")

class QueryResponse(BaseModel):
    answer: str = Field(..., description="The AI-generated answer.")
