from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StartSessionRequest(BaseModel):
    document_id: str
    support_mode: str = "medium"  # light, medium, high


class SessionResponse(BaseModel):
    id: str
    document_id: str
    started_at: datetime
    last_active_at: datetime
    current_chunk_id: Optional[str] = None
    support_mode: str
    completed: bool

    class Config:
        from_attributes = True


class EventRequest(BaseModel):
    event_type: str
    chunk_id: Optional[str] = None
    event_value: Optional[str] = None


class ChatSupportRequest(BaseModel):
    question: str
    chunk_id: Optional[str] = None


class SupportMessageResponse(BaseModel):
    id: str
    chunk_id: Optional[str] = None
    support_type: str
    content: str
    trigger_source: str
    created_at: datetime

    class Config:
        from_attributes = True
