"""Hybrid retrieval: semantic (vector) + structural (current/prev/next/section)."""
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.document import DocumentChunk, ChunkEmbedding
from app.config import get_settings
import math


_settings = get_settings()


def get_embedding_for_chunk(db: Session, chunk_id: str) -> list[float] | None:
    row = db.query(ChunkEmbedding).filter(ChunkEmbedding.chunk_id == chunk_id).first()
    return list(row.embedding) if row and row.embedding else None


def semantic_search(
    db: Session,
    document_id: str,
    query_embedding: list[float],
    limit: int = 10,
) -> list[tuple[str, float]]:
    """Returns list of (chunk_id, similarity_score). Uses pgvector <=> operator (cosine distance)."""
    if not _settings.database_url.startswith("postgresql"):
        return []
    if not query_embedding:
        return []
    emb_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
    sql = text("""
        SELECT c.id, 1 - (e.embedding <=> :emb::vector) as score
        FROM document_chunks c
        JOIN chunk_embeddings e ON e.chunk_id = c.id
        WHERE c.document_id = :doc_id
        ORDER BY e.embedding <=> :emb::vector
        LIMIT :lim
    """)
    rows = db.execute(sql, {"emb": emb_str, "doc_id": document_id, "lim": limit}).fetchall()
    return [(r[0], float(r[1])) for r in rows]


def get_structural_context(
    db: Session,
    document_id: str,
    current_chunk_id: str,
    reading_order: int,
) -> dict:
    """Fetch current, previous, next, and same-section chunks."""
    chunk = db.query(DocumentChunk).filter(
        DocumentChunk.id == current_chunk_id,
        DocumentChunk.document_id == document_id,
    ).first()
    if not chunk:
        return {"current": None, "previous": None, "next": None, "same_section": []}
    prev = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.reading_order == reading_order - 1,
    ).first()
    nxt = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id,
        DocumentChunk.reading_order == reading_order + 1,
    ).first()
    same_sec = []
    if chunk.section_title:
        same_sec = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.section_title == chunk.section_title,
        ).order_by(DocumentChunk.reading_order).all()
    return {
        "current": chunk,
        "previous": prev,
        "next": nxt,
        "same_section": same_sec,
    }


def hybrid_score(
    semantic_score: float,
    structural_proximity: float,
    recency_relevance: float,
    w_semantic: float = 0.5,
    w_structural: float = 0.3,
    w_recency: float = 0.2,
) -> float:
    return w_semantic * semantic_score + w_structural * structural_proximity + w_recency * recency_relevance
