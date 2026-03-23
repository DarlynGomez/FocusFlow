from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.document import DocumentChunk
from app.services import document_service, retrieval_service, support_generation_service, reading_session_service, intervention_service
from pydantic import BaseModel

router = APIRouter(prefix="/chunks", tags=["Chunks"])


class SupportContent(BaseModel):
    content: str


def _get_chunk_and_check_user(db: Session, chunk_id: str, user_id: str) -> DocumentChunk:
    chunk = db.query(DocumentChunk).filter(DocumentChunk.id == chunk_id).first()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    doc = document_service.get_document_by_id(db, chunk.document_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return chunk


@router.post("/{chunk_id}/explain", response_model=SupportContent)
def explain_chunk(
    chunk_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    chunk = _get_chunk_and_check_user(db, chunk_id, user.id)
    content = support_generation_service.generate_explain(chunk.chunk_text)
    return SupportContent(content=content)


@router.post("/{chunk_id}/recap", response_model=SupportContent)
def recap_previous(
    chunk_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    chunk = _get_chunk_and_check_user(db, chunk_id, user.id)
    prev = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == chunk.document_id,
        DocumentChunk.reading_order == chunk.reading_order - 1,
    ).first()
    if not prev:
        return SupportContent(content="You're at the beginning of the document. No previous section to recap.")
    content = support_generation_service.generate_recap(prev.chunk_text)
    return SupportContent(content=content)


@router.post("/{chunk_id}/orient", response_model=SupportContent)
def orient_user(
    chunk_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    chunk = _get_chunk_and_check_user(db, chunk_id, user.id)
    ctx = retrieval_service.get_structural_context(db, chunk.document_id, chunk_id, chunk.reading_order)
    prev_text = ctx["previous"].chunk_text if ctx["previous"] else ""
    next_text = ctx["next"].chunk_text[:500] if ctx["next"] else ""
    context = f"Previous: {prev_text[:800]}\n\nNext: {next_text}"
    content = support_generation_service.generate_orient(
        chunk.chunk_text, chunk.section_title, context
    )
    return SupportContent(content=content)


@router.post("/{chunk_id}/why-it-matters", response_model=SupportContent)
def why_it_matters(
    chunk_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    chunk = _get_chunk_and_check_user(db, chunk_id, user.id)
    content = support_generation_service.generate_why_it_matters(chunk.chunk_text)
    return SupportContent(content=content)
