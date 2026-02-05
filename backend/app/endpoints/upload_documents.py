from fastapi import APIRouter, UploadFile, File, HTTPException


router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    return None