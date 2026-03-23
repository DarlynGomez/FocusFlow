from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime


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


# --- New schema for MVP ---

class DocumentListItem(BaseModel):
    id: str
    title: str
    original_filename: str
    status: str
    page_count: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentDetail(BaseModel):
    id: str
    title: str
    original_filename: str
    file_path: str
    status: str
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChunkOut(BaseModel):
    id: str
    chunk_index: int
    page_start: int
    page_end: int
    section_title: Optional[str] = None
    parent_section_title: Optional[str] = None
    title: str
    key_idea: Optional[str] = None
    why_it_matters: Optional[str] = None
    chunk_text: str
    simplified_text: Optional[str] = None
    estimated_read_time_seconds: Optional[int] = None
    difficulty_score: Optional[float] = None
    reading_order: int

    class Config:
        from_attributes = True


class OutlineNode(BaseModel):
    section_title: str
    parent_section_title: Optional[str] = None
    chunk_ids: List[str]
    chunk_titles: List[str]


class DocumentOutline(BaseModel):
    document_id: str
    nodes: List[OutlineNode]
