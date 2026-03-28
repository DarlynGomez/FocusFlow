# FocusFlow

FocusFlow is an AI reading companion that helps users stay oriented while reading dense academic documents. The app processes uploaded PDFs, splits them into chunks, tracks reading progress, and provides in-context AI support (explain, recap, orient, and why-it-matters prompts).

## MVP Includes

- Full-stack web app (FastAPI backend + Next.js frontend)
- Authentication (register/login)
- Document upload and PDF parsing
- Chunking and structured document navigation
- Reading sessions and progress-aware support prompts
- OpenAI-powered embeddings and reading assistance

## Repository Layout

- `backend/`: FastAPI API and data pipeline
- `apps/web/`: Next.js web app (primary UI)
- `frontend/`: legacy Vite frontend (not required for main MVP flow)
- `app.py`: Streamlit prototype entry point

## Run Locally (Web App)

### 1. Clone

```bash
git clone https://github.com/DarlynGomez/FocusFlow.git
cd FocusFlow
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` (optional but recommended). If omitted, defaults are used for local SQLite.

Example:

```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=sqlite:///./focusflow.db
SECRET_KEY=change-me-in-production-use-env
```

Run backend:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8002
```

### 3. Frontend Setup (Next.js)

Open a new terminal:

```bash
cd apps/web
npm install
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8002/api
```

Run frontend:

```bash
npm run dev -- -p 3000
```

Open http://localhost:3000

## What Other Users Get When They Clone

When someone clones from GitHub, they get exactly what is committed in the repository.

They do not automatically get your local runtime state, such as:

- Local database contents (for example `backend/focusflow.db` state at the moment on your machine)
- Local environment files and secrets (`.env`, `.env.local`, API keys)
- Active processes, installed virtual environments, or node_modules folders

To reproduce your environment, collaborators should follow the setup steps above and provide their own environment variables.

## Optional: Streamlit Prototype

The repo also contains a Streamlit prototype:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```


