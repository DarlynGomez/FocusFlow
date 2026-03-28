import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_service import query, get_structural_context, session_exists

router = APIRouter()
logger = logging.getLogger(__name__)


class QueryRequest(BaseModel):
    session_id: str
    question: str
    current_chunk_index: int = 0


class QueryResponse(BaseModel):
    answer: str
    source_chunks: list[dict]


@router.post("/query", response_model=QueryResponse)
async def query_document(body: QueryRequest):
    """
    Receives a user question, retrieves relevant chunks via FAISS,
    and returns an answer grounded in the document content.
    """
    if not session_exists(body.session_id):
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please re-upload the document."
        )

    # Retrieve the most relevant chunks for the question.
    retrieved_chunks = query(body.session_id, body.question, top_k=4)

    # Also get structural context (previous/current/next) so the AI
    # knows where in the document the user currently is.
    structural = get_structural_context(body.session_id, body.current_chunk_index)

    # Build the context string to pass to the AI.
    context_parts = []

    current = structural.get("current")
    if current:
        context_parts.append(
            f"The user is currently reading:\n{current.get('text') or current.get('chunk_text', '')}"
        )

    if retrieved_chunks:
        context_parts.append("Relevant sections from the document:")
        for i, chunk in enumerate(retrieved_chunks):
            text = chunk.get("text") or chunk.get("chunk_text", "")
            section = chunk.get("section_title", "")
            context_parts.append(f"[{i+1}] {('(' + section + ') ') if section else ''}{text}")

    context = "\n\n".join(context_parts)

    # Call the Anthropic Claude API with the retrieved context.
    # This is where your Claude integration goes -- for now returns a placeholder
    # that shows the retrieved chunks are working correctly.
    # Wire the actual API call here in the next sprint.
    answer = (
        f"Based on the document, here is what I found relevant to your question "
        f"'{body.question}':\n\n"
        + "\n\n".join(
            chunk.get("text") or chunk.get("chunk_text", "")
            for chunk in retrieved_chunks[:2]
        )
    )

    return QueryResponse(
        answer=answer,
        source_chunks=retrieved_chunks,
    )