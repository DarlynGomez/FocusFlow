import tempfile
import os
import logging
import uuid
from app.services.rag_service import build_index
from typing import Literal

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.document import DocumentResponse, TextChunk, ParseClassification, DocumentChunk
from app.services.pdf_engine import parse_pdf_smart
from app.services.chunker import chunk_elements
from app.services.pdf_parser_service import extract_pages, extract_blocks_reading_order
from app.services.enrichment_service import enrich_chunks


router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    guidance_level: Literal["light", "medium", "heavy"] = Form("medium"),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a file with a .pdf extension."
        )

    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum allowed size is 10MB."
        )

    if len(file_content) == 0:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_content)
            tmp_path = tmp.name

        parse_result = parse_pdf_smart(tmp_path)

        classification = ParseClassification(
            parser_used=parse_result["classification"]["parser"],
            routing_reasons=parse_result["classification"]["reasons"],
            signals=parse_result["classification"]["signals"],
        )

        elements = [
            TextChunk(
                text=elem["text"],
                element_type=elem["element_type"],
                page_number=elem.get("page_number"),
                char_count=elem["char_count"],
            )
            for elem in parse_result["elements"]
        ]

        # Extract images from the PDF using PyMuPDF and merge them into
        # the element list in reading order before chunking. Text elements
        # from the parser already carry page_number so the interleaving is
        # positional within each page via the bbox sort in extract_blocks_reading_order.
        try:
            pages = extract_pages(file_content)
            image_blocks = [
                block for block in extract_blocks_reading_order(pages)
                if block["type"] == "image"
            ]
        except Exception as img_err:
            logger.warning(f"Image extraction failed, continuing without images: {img_err}")
            image_blocks = []

        # Build a combined element list: text elements from the parser merged
        # with image blocks from PyMuPDF, sorted by page then reading order.
        # Text elements do not have a reading_order field so we sort images in
        # after text on the same page by appending them at the page boundary.
        text_elements = parse_result["elements"]

        # Group image blocks by page for fast lookup during merge.
        images_by_page: dict[int, list[dict]] = {}
        for img in image_blocks:
            page = img.get("page_number", 0)
            images_by_page.setdefault(page, []).append(img)

        # Walk text elements and splice images in whenever the page changes.
        merged_elements: list[dict] = []
        last_page: int | None = None
        for elem in text_elements:
            current_page = elem.get("page_number")
            if last_page is not None and current_page != last_page:
                # We have moved to a new page -- append any images from the
                # previous page before continuing with the new page's text.
                for img in images_by_page.pop(last_page, []):
                    merged_elements.append(img)
            merged_elements.append(elem)
            last_page = current_page

        # Append images from the final page and any pages with no text at all.
        for img_list in images_by_page.values():
            merged_elements.extend(img_list)

        raw_chunks = chunk_elements(merged_elements, guidance_level=guidance_level)

        # Enrich chunks with plain-English metadata and HTML table rendering
        raw_chunks = enrich_chunks(raw_chunks)

        chunks = [
            DocumentChunk(
                chunk_index=c["chunk_index"],
                text=c["text"],
                page_number=c.get("page_number"),
                element_type=c["element_type"],
                char_count=c["char_count"],
                is_section_start=c["is_section_start"],
                image_data=c.get("image_data"),
                image_width=c.get("image_width"),
                image_height=c.get("image_height"),
                title=c.get("title"),
                key_idea=c.get("key_idea"),
                why_it_matters=c.get("why_it_matters"),
                estimated_read_time_seconds=c.get("estimated_read_time_seconds"),
                rendered_html=c.get("rendered_html"),
            )
            for c in raw_chunks
        ]


        session_id = str(uuid.uuid4())
        build_index(session_id, raw_chunks)

        return DocumentResponse(
            filename=file.filename or "unknown_document.pdf",
            total_elements=len(elements),
            elements=elements,
            chunks=chunks,
            total_chunks=len(chunks),
            session_id=session_id,
            classification=classification,
            guidance_level=guidance_level,
            low_text_warning=parse_result["low_text_warning"],
            warning_message=parse_result.get("warning_message"),
        )

    except HTTPException:
        raise

    except RuntimeError as e:
        logger.error(f"PDF extraction failed for {file.filename}: {e}")
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from this PDF. The file may be corrupt or password-protected."
        )

    except Exception as e:
        logger.error(f"Unexpected error processing {file.filename}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while processing the document."
        )

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)