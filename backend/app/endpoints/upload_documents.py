# backend/app/endpoints/upload_documents.py

import tempfile
import os
import logging
from typing import Literal

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.schemas.document import DocumentResponse, TextChunk, ParseClassification
from app.services.pdf_engine import parse_pdf_smart

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    # guidance_level comes in as a form field alongside the file
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

        return DocumentResponse(
            filename=file.filename or "unknown_document.pdf",
            total_elements=len(elements),
            elements=elements,
            classification=classification,
            guidance_level=guidance_level,  # now passed in from the form field
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