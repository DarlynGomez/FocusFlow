"""Generate and store embeddings. OpenAI-compatible."""
from app.services.llm_service import embed
from sqlalchemy.orm import Session
from app.models.document import DocumentChunk, ChunkEmbedding
from app.utils.ids import generate_uuid


def embed_texts(texts: list[str]) -> list[list[float]]:
    return embed(texts)


def store_embedding(db: Session, chunk_id: str, vector: list[float]) -> ChunkEmbedding:
    e = ChunkEmbedding(
        id=generate_uuid(),
        chunk_id=chunk_id,
        embedding=vector,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return e
