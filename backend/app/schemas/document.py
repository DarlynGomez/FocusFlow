from pydantic import BaseModel
from typing import Optional, Literal


class TextChunk(BaseModel):
    text: str
    element_type: str = "text"
    page_number: Optional[int] = None
    char_count: int


class DocumentChunk(BaseModel):
    chunk_index: int
    text: str
    page_number: Optional[int] = None
    element_type: str
    char_count: int
    is_section_start: bool
    image_data: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    title: Optional[str] = None
    key_idea: Optional[str] = None
    why_it_matters: Optional[str] = None
    estimated_read_time_seconds: Optional[int] = None
    rendered_html: Optional[str] = None
    assessment_question: Optional[str] = None   # ← new
    assessment_answer: Optional[str] = None     # ← new


class ParseClassification(BaseModel):
    parser_used: str
    routing_reasons: list[str]
    signals: dict


class DocumentResponse(BaseModel):
    filename: str
    total_elements: int
    elements: list[TextChunk]
    chunks: list[DocumentChunk]
    total_chunks: int
    session_id: str
    classification: ParseClassification
    guidance_level: Literal["light", "medium", "heavy"]
    low_text_warning: bool = False
    warning_message: Optional[str] = None