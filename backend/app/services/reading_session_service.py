"""Reading session and event tracking."""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.document import DocumentChunk
from app.models.session import ReadingSession, ReadingEvent
from app.utils.ids import generate_uuid


def start_session(db: Session, user_id: str, document_id: str, support_mode: str = "medium") -> ReadingSession:
    s = ReadingSession(
        id=generate_uuid(),
        user_id=user_id,
        document_id=document_id,
        support_mode=support_mode,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def get_session(db: Session, session_id: str, user_id: str) -> ReadingSession | None:
    return db.query(ReadingSession).filter(
        ReadingSession.id == session_id,
        ReadingSession.user_id == user_id,
    ).first()


def update_current_chunk(db: Session, session_id: str, chunk_id: str) -> None:
    s = db.query(ReadingSession).filter(ReadingSession.id == session_id).first()
    if s:
        s.current_chunk_id = chunk_id
        s.last_active_at = datetime.now(timezone.utc)
        db.commit()


def record_event(
    db: Session,
    session_id: str,
    event_type: str,
    chunk_id: str | None = None,
    event_value: str | None = None,
) -> ReadingEvent:
    e = ReadingEvent(
        id=generate_uuid(),
        session_id=session_id,
        chunk_id=chunk_id,
        event_type=event_type,
        event_value=event_value,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    # Update session last_active
    s = db.query(ReadingSession).filter(ReadingSession.id == session_id).first()
    if s:
        s.last_active_at = datetime.now(timezone.utc)
        db.commit()
    return e


def get_revisit_count(db: Session, session_id: str, chunk_id: str) -> int:
    return db.query(ReadingEvent).filter(
        ReadingEvent.session_id == session_id,
        ReadingEvent.chunk_id == chunk_id,
        ReadingEvent.event_type == "chunk_opened",
    ).count()


def get_recent_chunk_ids(db: Session, session_id: str, limit: int = 20) -> list[str]:
    """Ordered by created_at desc (most recent first)."""
    rows = (
        db.query(ReadingEvent.chunk_id)
        .filter(
            ReadingEvent.session_id == session_id,
            ReadingEvent.chunk_id.isnot(None),
        )
        .order_by(ReadingEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows if r[0]]
