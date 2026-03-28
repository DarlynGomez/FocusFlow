"""Generate support content: recap, explain, orient, why_it_matters. All grounded in retrieved chunks."""
from app.services.llm_service import chat_completion
from app.prompts.support import (
    RECAP_SYSTEM,
    ORIENT_SYSTEM,
    WHY_IT_MATTERS_SYSTEM,
    EXPLAIN_SYSTEM,
    INTERVENTION_SYSTEM,
    CHAT_SUPPORT_SYSTEM,
)


def generate_recap(previous_chunk_text: str) -> str:
    if not previous_chunk_text.strip():
        return "No previous content to recap."
    return chat_completion(
        messages=[
            {"role": "system", "content": RECAP_SYSTEM},
            {"role": "user", "content": f"Previous chunk:\n\n{previous_chunk_text[:3000]}"},
        ],
    ).strip()


def generate_orient(current_chunk_text: str, section_title: str | None, context: str) -> str:
    return chat_completion(
        messages=[
            {"role": "system", "content": ORIENT_SYSTEM},
            {
                "role": "user",
                "content": f"Section: {section_title or 'N/A'}\n\nCurrent chunk:\n{current_chunk_text[:2000]}\n\nContext:\n{context[:1500]}",
            },
        ],
    ).strip()


def generate_why_it_matters(chunk_text: str) -> str:
    if not chunk_text.strip():
        return "No content provided."
    return chat_completion(
        messages=[
            {"role": "system", "content": WHY_IT_MATTERS_SYSTEM},
            {"role": "user", "content": f"Chunk:\n\n{chunk_text[:3000]}"},
        ],
    ).strip()


def generate_explain(chunk_text: str) -> str:
    if not chunk_text.strip():
        return "No content to explain."
    return chat_completion(
        messages=[
            {"role": "system", "content": EXPLAIN_SYSTEM},
            {"role": "user", "content": f"Chunk to simplify:\n\n{chunk_text[:3000]}"},
        ],
    ).strip()


def generate_intervention(chunk_text: str) -> str:
    if not chunk_text.strip():
        return "Here’s a quick recap of where you are."
    return chat_completion(
        messages=[
            {"role": "system", "content": INTERVENTION_SYSTEM},
            {"role": "user", "content": f"Current chunk:\n\n{chunk_text[:2500]}"},
        ],
    ).strip()


def generate_document_chat_answer(question: str, context_excerpts: list[str]) -> str:
    question = (question or "").strip()
    if not question:
        return "Please ask a question about the document."

    context = "\n\n---\n\n".join(context_excerpts[:6])
    if not context.strip():
        return "I could not find enough document context to answer that yet."

    return chat_completion(
        messages=[
            {"role": "system", "content": CHAT_SUPPORT_SYSTEM},
            {
                "role": "user",
                "content": f"Question:\n{question}\n\nDocument excerpts:\n{context[:14000]}",
            },
        ],
    ).strip()
