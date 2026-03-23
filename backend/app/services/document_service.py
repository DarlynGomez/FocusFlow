"""Document upload, storage, and processing pipeline."""
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.document import Document, DocumentPage, DocumentBlock, DocumentChunk, ChunkEmbedding, DocumentStatus
from app.models.user import User
from app.utils.ids import generate_uuid
from app.services.pdf_parser_service import extract_pages, extract_blocks_reading_order
from app.services.structure_inference_service import infer_structure, normalize_blocks, build_sections
from app.services.chunking_service import build_chunks
from app.services.chunk_metadata_service import generate_chunk_metadata
from app.services.embedding_service import embed_texts, store_embedding

_settings = get_settings()
_executor = ThreadPoolExecutor(max_workers=2)


def _ensure_upload_dir() -> Path:
    p = Path(_settings.upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def save_upload_file(file_content: bytes, filename: str, user_id: str, document_id: str) -> str:
    """Save file to upload_dir/user_id/document_id.ext. Returns relative file_path."""
    root = _ensure_upload_dir()
    user_dir = root / user_id
    user_dir.mkdir(exist_ok=True)
    ext = Path(filename).suffix or ".pdf"
    path = user_dir / f"{document_id}{ext}"
    path.write_bytes(file_content)
    return str(path.relative_to(root))


def create_document(
    db: Session,
    user_id: str,
    title: str,
    original_filename: str,
    file_path: str,
    document_id: str | None = None,
) -> Document:
    doc_id = document_id or generate_uuid()
    doc = Document(
        id=doc_id,
        user_id=user_id,
        title=title or original_filename,
        original_filename=original_filename,
        file_path=file_path,
        status=DocumentStatus.uploaded,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_document_by_id(db: Session, document_id: str, user_id: str) -> Document | None:
    return db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == user_id,
    ).first()


def list_documents(db: Session, user_id: str):
    return db.query(Document).filter(Document.user_id == user_id).order_by(Document.created_at.desc()).all()


def _run_processing(document_id: str) -> None:
    """Background: parse PDF, chunk, embed, save to DB."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc or doc.status != DocumentStatus.uploaded:
            return
        doc.status = DocumentStatus.processing
        db.commit()

        full_path = Path(_settings.upload_dir) / doc.file_path
        if not full_path.exists():
            doc.status = DocumentStatus.failed
            doc.error_message = "File not found"
            db.commit()
            return

        file_content = full_path.read_bytes()
        pages = extract_pages(file_content)
        doc.page_count = len(pages)

        for p in pages:
            db.add(DocumentPage(
                id=generate_uuid(),
                document_id=document_id,
                page_number=p.page_number,
                raw_text=p.raw_text,
                width=p.width,
                height=p.height,
            ))
        db.commit()

        blocks_raw = extract_blocks_reading_order(pages)
        for i, b in enumerate(blocks_raw):
            db.add(DocumentBlock(
                id=generate_uuid(),
                document_id=document_id,
                page_number=b["page_number"],
                block_index=b["block_index"],
                block_type_guess=b.get("block_type_guess"),
                text=b["text"],
                bbox_x0=b.get("bbox_x0"),
                bbox_y0=b.get("bbox_y0"),
                bbox_x1=b.get("bbox_x1"),
                bbox_y1=b.get("bbox_y1"),
                font_size_guess=b.get("font_size_guess"),
                reading_order=b["reading_order"],
            ))
        db.commit()

        blocks_with_structure = infer_structure(blocks_raw)
        normalized = normalize_blocks(blocks_with_structure)
        sections = build_sections(normalized)
        chunk_dicts = build_chunks(sections, _settings.chunk_target_words_min, _settings.chunk_target_words_max)

        chunk_ids = []
        for i, c in enumerate(chunk_dicts):
            meta = generate_chunk_metadata(c["chunk_text"])
            chunk = DocumentChunk(
                id=generate_uuid(),
                document_id=document_id,
                chunk_index=i,
                page_start=c["page_start"],
                page_end=c["page_end"],
                section_title=c.get("section_title"),
                parent_section_title=c.get("parent_section_title"),
                title=meta["title"],
                key_idea=meta.get("key_idea"),
                why_it_matters=meta.get("why_it_matters"),
                chunk_text=c["chunk_text"],
                estimated_read_time_seconds=meta.get("estimated_read_time_seconds"),
                reading_order=c["reading_order"],
            )
            db.add(chunk)
            db.flush()
            chunk_ids.append((chunk.id, c["chunk_text"]))

        db.commit()

        texts = [t for _, t in chunk_ids]
        embeddings = embed_texts(texts)
        for (chunk_id, _), vec in zip(chunk_ids, embeddings):
            store_embedding(db, chunk_id, vec)

        doc.status = DocumentStatus.ready
        doc.error_message = None
        db.commit()
    except Exception as e:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = DocumentStatus.failed
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()


def start_processing(document_id: str) -> None:
    _executor.submit(_run_processing, document_id)
