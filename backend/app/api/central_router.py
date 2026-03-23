# Central hub that groups all routers/endpoints

from fastapi import APIRouter
from app.endpoints import upload_documents

api_router = APIRouter()


api_router.include_router(upload_documents.router, prefix="/documents", tags=["Documents"])
