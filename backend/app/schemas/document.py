from pydantic import BaseModel
from typing import List, Optional, Any
class TextChunk(BaseModel):
    chunk_id: int
    title: str
    key_idea: str
    content: str
    page_start: int
    page_end: int


class DocumentResponse(BaseModel):
    filename: str
    total_chunks: int
    chunks: Optional[List[TextChunk]] = [] 
    raw: Optional[List[Any]] = None