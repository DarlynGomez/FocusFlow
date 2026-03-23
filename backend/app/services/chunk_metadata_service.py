"""Generate chunk title, key_idea, why_it_matters, estimated_read_time via LLM."""
from app.services.llm_service import chat_completion
from app.prompts.chunk_metadata import CHUNK_METADATA_SYSTEM, chunk_metadata_user
import json
import re


def generate_chunk_metadata(chunk_text: str) -> dict:
    """Returns dict with title, key_idea, why_it_matters, estimated_read_time_seconds."""
    content = chat_completion(
        messages=[
            {"role": "system", "content": CHUNK_METADATA_SYSTEM},
            {"role": "user", "content": chunk_metadata_user(chunk_text)},
        ],
        response_format={"type": "json_object"},
    )
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Fallback: try to extract from markdown code block or raw
        m = re.search(r"\{[^{}]*\}", content, re.DOTALL)
        if m:
            data = json.loads(m.group())
        else:
            data = {
                "title": "Section",
                "key_idea": chunk_text[:200] + ("..." if len(chunk_text) > 200 else ""),
                "why_it_matters": "Relevant to the document.",
                "estimated_read_time_seconds": 90,
            }
    return {
        "title": str(data.get("title", "Section"))[:512],
        "key_idea": str(data.get("key_idea", ""))[:1024] if data.get("key_idea") else None,
        "why_it_matters": str(data.get("why_it_matters", ""))[:1024] if data.get("why_it_matters") else None,
        "estimated_read_time_seconds": int(data.get("estimated_read_time_seconds", 90)),
    }
