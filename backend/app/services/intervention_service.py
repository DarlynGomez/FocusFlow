"""Decide whether to show intervention and generate message. Light/medium/high support modes."""
from sqlalchemy.orm import Session
from app.models.session import ReadingSession, SupportMessage
from app.models.document import DocumentChunk
from app.services.reading_session_service import get_revisit_count
from app.services.support_generation_service import generate_intervention, generate_explain
from app.utils.ids import generate_uuid


def should_offer_intervention(
    db: Session,
    session: ReadingSession,
    chunk_id: str,
    trigger: str,  # idle, revisit, explicit
) -> bool:
    if trigger == "explicit":
        return True
    if session.support_mode == "light":
        return False
    if session.support_mode == "high":
        if trigger in ("idle", "revisit"):
            return True
    if session.support_mode == "medium":
        if trigger == "revisit":
            count = get_revisit_count(db, session.id, chunk_id)
            if count >= 2:
                return True
        if trigger == "idle":
            return True
    return False


def create_support_message(
    db: Session,
    session_id: str,
    chunk_id: str,
    support_type: str,
    content: str,
    trigger_source: str,
) -> SupportMessage:
    m = SupportMessage(
        id=generate_uuid(),
        session_id=session_id,
        chunk_id=chunk_id,
        support_type=support_type,
        content=content,
        trigger_source=trigger_source,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def get_current_support(db: Session, session_id: str) -> SupportMessage | None:
    """Latest support message for this session (for UI to show)."""
    return (
        db.query(SupportMessage)
        .filter(SupportMessage.session_id == session_id)
        .order_by(SupportMessage.created_at.desc())
        .first()
    )
