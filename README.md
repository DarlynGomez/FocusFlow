# FocusFlow

**FocusFlow** is an AI-powered cognitive reading assistant for neurodivergent users (especially ADHD, executive function challenges, or learning disabilities) who struggle with dense PDFs. It turns static PDFs into structured, session-aware reading experiences with just-in-time support: recaps, “you are here” orientation, simplified explanations, and section connections.

---

## Architecture

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS — in `apps/web`
- **Backend:** FastAPI (Python) — in `backend`
- **Database:** PostgreSQL with pgvector for embeddings

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ with [pgvector](https://github.com/pgvector/pgvector) extension

### Enable pgvector (PostgreSQL)

```bash
# In psql or your DB tool:
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Backend setup

1. **Create virtual environment and install dependencies**

   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate   # Windows
   # source venv/bin/activate  # macOS/Linux
   pip install -r requirements.txt
   ```

2. **Configure environment**

   Copy `backend/.env.example` to `backend/.env` and set at least:

   - `DATABASE_URL` — PostgreSQL connection string
   - `SECRET_KEY` — random string for JWT
   - `OPENAI_API_KEY` — for chunk metadata and support generation

3. **Create database and run migrations**

   ```bash
   createdb focusflow   # or create via your DB tool
   # From backend directory, with venv active:
   set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/focusflow
   alembic upgrade head
   ```

4. **Run the API**

   ```bash
   uvicorn app.main:app --reload
   ```

   API: http://localhost:8000

---

## Frontend setup

1. **Install and run**

   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

2. **Optional:** Copy `apps/web/.env.local.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL` if the API is not at `http://localhost:8000/api`.

   App: http://localhost:3000

---

## User flow

1. **Register / Log in** — Landing → Register or Login.
2. **Upload a PDF** — Dashboard → Upload PDF. File is stored and processing starts in the background.
3. **Wait for processing** — Document status page polls until status is `ready` (parse → structure → chunk → LLM metadata → embeddings).
4. **Read** — Open the document from the dashboard. Read chunk-by-chunk; use “Explain this”, “Recap previous”, “Where am I?”, “Why does this matter?” for support. Progress and outline are in the left sidebar; support content appears in the right panel.

---

## Project structure

```
FocusFlow-main/
├── apps/
│   └── web/                 # Next.js 14 frontend
│       └── src/app/          # App Router pages
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py
│   │   ├── deps.py           # Auth dependency
│   │   ├── db/               # Session, init
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── routers/          # auth, documents, sessions, chunks
│   │   ├── services/         # document, pdf_parser, chunking, embedding, retrieval, support_generation, etc.
│   │   └── prompts/         # LLM prompts
│   ├── alembic/              # Migrations
│   └── requirements.txt
├── README.md
└── (legacy frontend/ and app.py Streamlit remain for reference)
```

---

## API overview

- `POST /api/auth/register` — Register (email, password)
- `POST /api/auth/login` — Login → JWT
- `GET /api/documents` — List user’s documents
- `POST /api/documents/upload` — Upload PDF (starts processing)
- `GET /api/documents/{id}` — Document detail + status
- `GET /api/documents/{id}/chunks` — Chunks for reading
- `GET /api/documents/{id}/outline` — Section outline
- `POST /api/sessions/start` — Start reading session
- `POST /api/sessions/{id}/event` — Record event (chunk_opened, etc.)
- `POST /api/chunks/{id}/explain` — Simplified explanation
- `POST /api/chunks/{id}/recap` — Recap previous chunk
- `POST /api/chunks/{id}/orient` — Where am I in the document
- `POST /api/chunks/{id}/why-it-matters` — Why this section matters

---

## Success criteria (MVP)

- [x] User auth (register / login)
- [x] PDF upload and background processing
- [x] Document list and processing status
- [x] Layout-aware parsing and cognitive chunking
- [x] Chunk metadata (title, key idea, why it matters, read time) via LLM
- [x] Embeddings and pgvector storage
- [x] Reading UI: chunk-by-chunk, outline, progress
- [x] Support actions: Explain, Recap, Where am I?, Why it matters
- [x] Session and event tracking
- [x] Basic reading settings (font size on reading page)FocusFlow is a **session-aware cognitive reading assistant**, not a generic summarizer or chatbot. The MVP delivers the core loop: upload → process → read with grounded, in-context support.
