from pydantic import BaseModel
from typing import Optional, Literal


class TextChunk(BaseModel):
    # The actual text content of this chunk
    text: str
    element_type: str = "text"
    page_number: Optional[int] = None
    char_count: int


class ParseClassification(BaseModel):
    parser_used: str
    routing_reasons: list[str]
    signals: dict


class DocumentResponse(BaseModel):
    filename: str
    # Total number of extracted elements before chunking
    total_elements: int
    # The extracted elements
    elements: list[TextChunk]
    # How the document was classified and which parser was selected
    classification: ParseClassification
    # The guidance level from the request
    guidance_level: Literal["light", "medium", "heavy"]
    low_text_warning: bool = False
    warning_message: Optional[str] = None