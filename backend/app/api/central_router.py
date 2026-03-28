from fastapi import APIRouter
from app.endpoints import upload_documents, query_document

api_router = APIRouter()
api_router.include_router(upload_documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(query_document.router, prefix="/documents", tags=["Query"])