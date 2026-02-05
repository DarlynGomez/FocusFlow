# App Entry point

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.central_router import api_router


app = FastAPI(title="FocusFlow API")

# Configure CORS
origins = [
    "http://localhost:5173",  # For our frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Frontend can call for example: POST http://localhost:8000/api/documents_upload
app.include_router(api_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "running", "message": "FocusFlow Agent is active"}