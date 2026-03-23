from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class ReadingSession(Base):
    __tablename__ = "reading_sessions"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    current_chunk_id = Column(String(36), ForeignKey("document_chunks.id"), nullable=True)
    support_mode = Column(String(32), nullable=False, default="medium")  # light, medium, high
    completed = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="reading_sessions")
    document = relationship("Document", back_populates="reading_sessions")
    events = relationship("ReadingEvent", back_populates="session", order_by="ReadingEvent.created_at")
    support_messages = relationship("SupportMessage", back_populates="session", order_by="SupportMessage.created_at")


class ReadingEvent(Base):
    __tablename__ = "reading_events"

    id = Column(String(36), primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("reading_sessions.id"), nullable=False, index=True)
    chunk_id = Column(String(36), ForeignKey("document_chunks.id"), nullable=True)
    event_type = Column(String(64), nullable=False)  # chunk_opened, chunk_completed, chunk_revisited, help_clicked, user_idle, etc.
    event_value = Column(Text, nullable=True)  # JSON string for extra data
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReadingSession", back_populates="events")


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(String(36), primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey("reading_sessions.id"), nullable=False, index=True)
    chunk_id = Column(String(36), ForeignKey("document_chunks.id"), nullable=True)
    support_type = Column(String(64), nullable=False)  # recap, explain, orient, why_it_matters
    content = Column(Text, nullable=False)
    trigger_source = Column(String(64), nullable=False)  # explicit, idle, revisit, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReadingSession", back_populates="support_messages")
