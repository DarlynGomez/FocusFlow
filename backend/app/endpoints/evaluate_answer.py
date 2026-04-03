import logging
import re
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_service import session_exists
from app.services.llm_service import complete

router = APIRouter()
logger = logging.getLogger(__name__)


class EvaluateRequest(BaseModel):
    session_id: str
    chunk_index: int
    question: str
    ideal_answer: str
    student_answer: str


class EvaluateResponse(BaseModel):
    correct: bool
    feedback: str


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate_answer(body: EvaluateRequest):
    if not session_exists(body.session_id):
        raise HTTPException(status_code=404, detail="Session not found.")

    student = body.student_answer.strip()
    if not student:
        raise HTTPException(status_code=400, detail="Student answer is required.")

    prompt = f"""You are evaluating a student's comprehension of an academic paper section.

Question: {body.question}

Ideal answer (reference only — do not quote verbatim, student does not need to match exactly):
{body.ideal_answer}

Student's answer:
{student}

Evaluate strictly. The student must demonstrate they understood the CORE CONCEPT — not just write something vaguely related. A blank answer, a single word, "I don't know", or an answer that doesn't address the question at all must be marked incorrect.

Criteria for CORRECT:
- Shows understanding of the main finding, mechanism, or argument of the section
- Addresses what was actually asked
- Does not need to match wording but must show conceptual grasp

Criteria for INCORRECT:
- Off-topic or irrelevant
- Too vague to demonstrate understanding ("it was about research" is not enough)
- Factually wrong about the section's content
- Doesn't answer the question asked

Respond with a JSON object:
- "correct": true or false (boolean, not string)
- "feedback": 1-2 sentences. If correct, affirm the specific thing they got right. If incorrect, explain the key concept they missed — be encouraging but honest. Never say "wrong". Say "not quite" or "almost there".

JSON only. No markdown, no preamble."""

    raw = complete(prompt, max_tokens=200)
    if raw is None:
        raise HTTPException(status_code=500, detail="Evaluation service unavailable.")

    try:
        cleaned = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned)
        return EvaluateResponse(
            correct=bool(result.get("correct", False)),
            feedback=result.get("feedback", ""),
        )
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"Evaluate parse failed: {e} | raw: {raw}")
        raise HTTPException(status_code=500, detail="Could not parse evaluation response.")