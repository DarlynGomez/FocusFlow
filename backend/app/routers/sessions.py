from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.document import DocumentChunk
from app.schemas.session import (
    StartSessionRequest,
    SessionResponse,
    EventRequest,
    SupportMessageResponse,
    ChatSupportRequest,
)
from app.services import reading_session_service, intervention_service, support_generation_service
import re

router = APIRouter(prefix="/sessions", tags=["Sessions"])


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-zA-Z0-9]{3,}", text.lower())}


@router.post("/start", response_model=SessionResponse)
def start_session(
    body: StartSessionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = reading_session_service.start_session(db, user.id, body.document_id, body.support_mode)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = reading_session_service.get_session(db, session_id, user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/{session_id}/event")
def record_event(
    session_id: str,
    body: EventRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = reading_session_service.get_session(db, session_id, user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if body.chunk_id:
        reading_session_service.update_current_chunk(db, session_id, body.chunk_id)
    reading_session_service.record_event(db, session_id, body.event_type, body.chunk_id, body.event_value)
    return {"ok": True}


@router.get("/{session_id}/support/current", response_model=SupportMessageResponse | None)
def get_current_support(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = reading_session_service.get_session(db, session_id, user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    msg = intervention_service.get_current_support(db, session_id)
    return msg


@router.post("/{session_id}/support/chat", response_model=SupportMessageResponse)
def chat_support(
    session_id: str,
    body: ChatSupportRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = reading_session_service.get_session(db, session_id, user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    active_chunk_id = body.chunk_id or session.current_chunk_id
    current_chunk = None
    if active_chunk_id:
        current_chunk = db.query(DocumentChunk).filter(
            DocumentChunk.id == active_chunk_id,
            DocumentChunk.document_id == session.document_id,
        ).first()
        if body.chunk_id and not current_chunk:
            raise HTTPException(status_code=404, detail="Chunk not found")

    ordered_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == session.document_id,
    ).order_by(DocumentChunk.reading_order.asc()).all()

    if not ordered_chunks:
        raise HTTPException(status_code=400, detail="Document has no chunks")

    selected: list[DocumentChunk] = []
    selected_ids: set[str] = set()

    def add_chunk(chunk: DocumentChunk | None) -> None:
        if not chunk or chunk.id in selected_ids:
            return
        selected.append(chunk)
        selected_ids.add(chunk.id)

    if current_chunk:
        add_chunk(current_chunk)
        for idx, chunk in enumerate(ordered_chunks):
            if chunk.id == current_chunk.id:
                if idx > 0:
                    add_chunk(ordered_chunks[idx - 1])
                if idx < len(ordered_chunks) - 1:
                    add_chunk(ordered_chunks[idx + 1])
                break

    question_tokens = _tokenize(question)
    scored: list[tuple[int, DocumentChunk]] = []
    if question_tokens:
        for chunk in ordered_chunks:
            haystack = " ".join([
                chunk.title or "",
                chunk.section_title or "",
                chunk.key_idea or "",
                chunk.why_it_matters or "",
                chunk.chunk_text[:2400],
            ]).lower()
            token_score = sum(1 for token in question_tokens if token in haystack)
            if current_chunk and chunk.id == current_chunk.id:
                token_score += 2
            if token_score > 0:
                scored.append((token_score, chunk))

    scored.sort(key=lambda x: (-x[0], x[1].reading_order))
    for _, chunk in scored:
        if len(selected) >= 5:
            break
        add_chunk(chunk)

    if not selected:
        selected = ordered_chunks[:3]

    excerpts = []
    for chunk in selected[:5]:
        section = chunk.section_title or "Document"
        excerpts.append(
            "\n".join([
                f"Chunk title: {chunk.title}",
                f"Section: {section}",
                f"Reading order: {chunk.reading_order}",
                f"Excerpt: {chunk.chunk_text[:1400]}",
            ])
        )

    answer = support_generation_service.generate_document_chat_answer(question, excerpts)

    msg = intervention_service.create_support_message(
        db=db,
        session_id=session.id,
        chunk_id=current_chunk.id if current_chunk else None,
        support_type="chat",
        content=answer,
        trigger_source="chat",
    )

    reading_session_service.record_event(
        db=db,
        session_id=session.id,
        event_type="support_chat",
        chunk_id=current_chunk.id if current_chunk else None,
        event_value=question[:500],
    )

    return msg
