import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_service import build_index, session_exists

router = APIRouter()
logger = logging.getLogger(__name__)


class RestoreRequest(BaseModel):
    session_id: str
    # The chunks array from the stored document response
    chunks: list[dict]


class RestoreResponse(BaseModel):
    session_id: str
    restored: bool


@router.post("/restore", response_model=RestoreResponse)
async def restore_session(body: RestoreRequest):
    """
    Rebuilds the in-memory FAISS index for a previously uploaded document.
    Called when a user opens a saved document from the homepage.
    The frontend sends the stored chunks and we re-embed them.
    This is fast because we skip PDF parsing entirely.
    """
    if session_exists(body.session_id):
        # Index already exists in memory
        return RestoreResponse(session_id=body.session_id, restored=False)

    if not body.chunks:
        raise HTTPException(
            status_code=400,
            detail="No chunks provided. Cannot restore session."
        )

    build_index(body.session_id, body.chunks)
    logger.info(f"Restored session {body.session_id} with {len(body.chunks)} chunks")

    return RestoreResponse(session_id=body.session_id, restored=True)