from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.db.session import Base
from app.config import get_settings
import enum


_settings = get_settings()
EMBEDDING_COLUMN_TYPE = Vector(1536) if _settings.database_url.startswith("postgresql") else JSON


class DocumentStatus(str, enum.Enum):
    uploaded = "uploaded"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(512), nullable=False)
    original_filename = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.uploaded, nullable=False)
    page_count = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)  # if status == failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", order_by="DocumentPage.page_number")
    blocks = relationship("DocumentBlock", back_populates="document", order_by="DocumentBlock.reading_order")
    chunks = relationship("DocumentChunk", back_populates="document", order_by="DocumentChunk.chunk_index")
    reading_sessions = relationship("ReadingSession", back_populates="document")


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(String(36), primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    raw_text = Column(Text, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)

    document = relationship("Document", back_populates="pages")


class DocumentBlock(Base):
    __tablename__ = "document_blocks"

    id = Column(String(36), primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    block_index = Column(Integer, nullable=False)
    block_type_guess = Column(String(64), nullable=True)  # heading, paragraph, list_item, etc.
    text = Column(Text, nullable=False)
    bbox_x0 = Column(Float, nullable=True)
    bbox_y0 = Column(Float, nullable=True)
    bbox_x1 = Column(Float, nullable=True)
    bbox_y1 = Column(Float, nullable=True)
    font_size_guess = Column(Float, nullable=True)
    reading_order = Column(Integer, nullable=False)

    document = relationship("Document", back_populates="blocks")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_start = Column(Integer, nullable=False)
    page_end = Column(Integer, nullable=False)
    section_title = Column(String(512), nullable=True)
    parent_section_title = Column(String(512), nullable=True)
    title = Column(String(512), nullable=False)
    key_idea = Column(Text, nullable=True)
    why_it_matters = Column(Text, nullable=True)
    chunk_text = Column(Text, nullable=False)
    simplified_text = Column(Text, nullable=True)
    estimated_read_time_seconds = Column(Integer, nullable=True)
    difficulty_score = Column(Float, nullable=True)
    reading_order = Column(Integer, nullable=False)

    document = relationship("Document", back_populates="chunks")
    embedding = relationship("ChunkEmbedding", back_populates="chunk", uselist=False)


class ChunkEmbedding(Base):
    __tablename__ = "chunk_embeddings"

    id = Column(String(36), primary_key=True, index=True)
    chunk_id = Column(String(36), ForeignKey("document_chunks.id"), nullable=False, unique=True, index=True)
    embedding = Column(EMBEDDING_COLUMN_TYPE, nullable=False)  # Vector on PostgreSQL, JSON elsewhere

    chunk = relationship("DocumentChunk", back_populates="embedding")
