from fastapi import APIRouter, UploadFile, File, HTTPException
from app.schemas.document import DocumentResponse, TextChunk
from app.services.pdf_engine import extract_text_from_pdf

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:

        file_content = await file.read()
        raw_data = await extract_text_from_pdf(file_content)


        return DocumentResponse(
            filename=file.filename or "unknown_document.pdf",
            total_chunks=0,
            chunks=None,
            raw=raw_data,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Erro processing PDF: {str(e)}')