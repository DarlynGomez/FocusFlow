import logging
import re
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_service import session_exists, get_structural_context
from app.services.llm_service import complete

router = APIRouter()
logger = logging.getLogger(__name__)


class RegenerateRequest(BaseModel):
    session_id: str
    chunk_index: int
    previous_question: str


class RegenerateResponse(BaseModel):
    question: str
    ideal_answer: str


@router.post("/regenerate-question", response_model=RegenerateResponse)
async def regenerate_question(body: RegenerateRequest):
    if not session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found.")

    structural = get_structural_context(body.session_id, body.chunk_index)
    section_text = ""
    for key in ("previous", "current", "next"):
        chunk = structural.get(key)
        if chunk:
            section_text += (chunk.get("text") or chunk.get("chunk_text", "")) + "\n\n"

    prompt = f"""You are generating a comprehension question for a neurodivergent student reading an academic paper.

Section content:
{section_text[:2000]}

Previous question already asked (generate something DIFFERENT that tests a different aspect):
{body.previous_question}

Generate one new short-answer comprehension question that:
- Tests a DIFFERENT concept or aspect than the previous question
- Requires understanding, not just recall
- Can be answered in 1-3 sentences
- Connects the section content to the paper's broader argument

Respond with JSON:
- "question": the new question string
- "ideal_answer": 2-3 sentence model answer showing full understanding

JSON only. No preamble, no markdown."""

    raw = complete(prompt, max_tokens=300)
    if raw is None:
        raise HTTPException(status_code=500, detail="Could not generate question.")

    try:
        cleaned = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned)
        return RegenerateResponse(
            question=result.get("question", ""),
            ideal_answer=result.get("ideal_answer", ""),
        )
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"Regenerate parse failed: {e}")
        raise HTTPException(status_code=500, detail="Could not parse generated question.")