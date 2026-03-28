import logging
import numpy as np
from typing import Optional
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# In-memory store: session_id -> {"index": faiss_index, "chunks": list[dict]}
_session_store: dict = {}

# Load the embedding model once at module import time
_model: Optional[SentenceTransformer] = None

def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading sentence transformer model...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def build_index(session_id: str, chunks: list[dict]) -> None:
    """
    Takes the chunk list produced by the chunker and builds a FAISS index
    in memory for this session. Called once at upload time.

    Each chunk dict needs at minimum: chunk_index, text, page_number,
    element_type, section_title (optional).
    """
    import faiss

    model = _get_model()

    # Extract the text from each chunk for embedding.
    # We use the chunk text as the embedding input.
    texts = [c.get("text") or c.get("chunk_text", "") for c in chunks]

    if not texts:
        logger.warning(f"No texts to embed for session {session_id}")
        return

    # Encode all chunk texts into embedding vectors.
    # Shape: (num_chunks, embedding_dim)
    embeddings = model.encode(texts, convert_to_numpy=True)
    embeddings = embeddings.astype(np.float32)

    # Normalize vectors for cosine similarity search.
    # FAISS IndexFlatIP (inner product) on normalized vectors = cosine similarity.
    faiss.normalize_L2(embeddings)

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings)

    _session_store[session_id] = {
        "index": index,
        "chunks": chunks,
        "embeddings": embeddings,
    }

    logger.info(
        f"Built FAISS index for session {session_id}: "
        f"{len(chunks)} chunks, dimension {dimension}"
    )


def query(session_id: str, question: str, top_k: int = 4) -> list[dict]:
    """
    Embeds the user's question and retrieves the top_k most relevant chunks
    from the session's FAISS index.

    Returns a list of chunk dicts with an added similarity_score field.
    Returns empty list if the session has no index.
    """
    import faiss

    session = _session_store.get(session_id)
    if not session:
        logger.warning(f"No FAISS index found for session {session_id}")
        return []

    model = _get_model()
    index = session["index"]
    chunks = session["chunks"]

    # Embed the question the same way we embedded the chunks.
    question_embedding = model.encode([question], convert_to_numpy=True).astype(np.float32)
    faiss.normalize_L2(question_embedding)

    # Search returns distances and indices of the top_k nearest neighbors.
    k = min(top_k, len(chunks))
    distances, indices = index.search(question_embedding, k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0:
            continue
        chunk = dict(chunks[idx])
        chunk["similarity_score"] = float(dist)
        results.append(chunk)

    return results


def get_structural_context(session_id: str, chunk_index: int) -> dict:
    """
    Returns the previous chunk, current chunk, and next chunk by index.
    This mirrors Shatakshi's get_structural_context but without the database.
    Used to give the AI panel narrative context around where the user is.
    """
    session = _session_store.get(session_id)
    if not session:
        return {"previous": None, "current": None, "next": None}

    chunks = session["chunks"]
    chunk_map = {c.get("chunk_index", i): c for i, c in enumerate(chunks)}

    return {
        "previous": chunk_map.get(chunk_index - 1),
        "current": chunk_map.get(chunk_index),
        "next": chunk_map.get(chunk_index + 1),
    }


def session_exists(session_id: str) -> bool:
    return session_id in _session_store


def clear_session(session_id: str) -> None:
    """Remove a session's index from memory. Called if needed for cleanup."""
    _session_store.pop(session_id, None)