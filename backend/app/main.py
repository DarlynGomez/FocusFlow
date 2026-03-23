# FocusFlow API

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, documents, sessions, chunks
from app.db.init_db import init_db

app = FastAPI(title="FocusFlow API")

app.add_middleware(
    CORSMiddleware,
    # Allow any localhost/127 dev port so frontend can run on fallback ports (3001/3002/etc).
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(chunks.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def health_check():
    return {"status": "running", "message": "FocusFlow API"}
