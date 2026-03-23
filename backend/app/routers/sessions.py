from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.session import StartSessionRequest, SessionResponse, EventRequest, SupportMessageResponse
from app.services import reading_session_service, intervention_service

router = APIRouter(prefix="/sessions", tags=["Sessions"])


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
