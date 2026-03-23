from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.document import DocumentStatus
from app.schemas.document import DocumentListItem, DocumentDetail, ChunkOut, DocumentOutline, OutlineNode
from app.services import document_service
from app.utils.ids import generate_uuid

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=list[DocumentListItem])
def list_docs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    docs = document_service.list_documents(db, user.id)
    return docs


@router.post("/upload", response_model=DocumentDetail)
def upload_document(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    doc_id = generate_uuid()
    content = file.file.read()
    file_path = document_service.save_upload_file(content, file.filename or "document.pdf", user.id, doc_id)
    title = (file.filename or "document.pdf").replace(".pdf", "")
    doc = document_service.create_document(
        db, user.id, title, file.filename or "document.pdf", file_path, document_id=doc_id
    )
    document_service.start_processing(doc.id)
    return doc


@router.get("/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = document_service.get_document_by_id(db, document_id, user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/{document_id}/process")
def process_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = document_service.get_document_by_id(db, document_id, user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != DocumentStatus.uploaded:
        raise HTTPException(status_code=400, detail="Document already processing or processed")
    document_service.start_processing(doc.id)
    return {"status": "processing_started"}


@router.get("/{document_id}/chunks", response_model=list[ChunkOut])
def get_chunks(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = document_service.get_document_by_id(db, document_id, user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return list(doc.chunks)


@router.get("/{document_id}/outline", response_model=DocumentOutline)
def get_outline(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doc = document_service.get_document_by_id(db, document_id, user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    from collections import OrderedDict
    section_to_chunks: dict[str, tuple[list, str | None]] = OrderedDict()
    for c in doc.chunks:
        sec = c.section_title or "_no_section"
        if sec not in section_to_chunks:
            section_to_chunks[sec] = ([], c.parent_section_title)
        section_to_chunks[sec][0].append((c.id, c.title))
    nodes = [
        OutlineNode(
            section_title=sec,
            parent_section_title=parent,
            chunk_ids=[x[0] for x in ch],
            chunk_titles=[x[1] for x in ch],
        )
        for sec, (ch, parent) in section_to_chunks.items()
    ]
    return DocumentOutline(document_id=document_id, nodes=nodes)
