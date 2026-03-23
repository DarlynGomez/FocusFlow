"""Create tables and optional seed. Call after migrations or for dev."""
from app.db.session import engine, Base
from app.models import (
    User,
    Document,
    DocumentPage,
    DocumentBlock,
    DocumentChunk,
    ChunkEmbedding,
    ReadingSession,
    ReadingEvent,
    SupportMessage,
)

def init_db() -> None:
    Base.metadata.create_all(bind=engine)
