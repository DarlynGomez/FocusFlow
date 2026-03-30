import json
import logging
import re
from app.services.llm_service import complete

logger = logging.getLogger(__name__)
WORDS_PER_MINUTE = 200


def _estimated_read_time(text: str) -> int:
    words = len(text.split())
    return max(5, round((words / WORDS_PER_MINUTE) * 60))


def _build_image_context(chunks: list[dict], current_index: int) -> str:
    """
    Collects the captions of any images that appear within 2 chunks of the
    current chunk so the enrichment LLM has figure context without needing
    to process the actual image bytes.
    """
    context_lines = []
    window = range(max(0, current_index - 2), min(len(chunks), current_index + 3))
    for i in window:
        c = chunks[i]
        if c.get("element_type") == "caption":
            context_lines.append(f"- Nearby figure/table: {c.get('text', '')}")
    return "\n".join(context_lines)


def _enrich_text_chunk(chunk: dict, all_chunks: list[dict], index: int) -> dict:
    text = chunk.get("text", "").strip()
    if not text:
        return chunk

    image_context = _build_image_context(all_chunks, index)
    figure_note = f"\nNearby figures:\n{image_context}" if image_context else ""

    prompt = f"""You are helping a neurodivergent student read an academic document.
The student reads the ORIGINAL text exactly as written. Your job is metadata only.
Do NOT rewrite, paraphrase, or summarize the passage.{figure_note}

Respond with a JSON object with exactly these keys:
- "key_idea": one plain-English sentence, max 12 words, naming the single most important point
- "why_it_matters": one sentence, max 15 words, on why a student should pay attention
- "estimated_read_time_seconds": integer at 150 words per minute

JSON only. No preamble, no markdown fences.

Passage:
{text[:1200]}"""

    raw = complete(prompt, max_tokens=200)
    if raw is None:
        return chunk

    try:
        cleaned = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip(), flags=re.MULTILINE)
        enrichment = json.loads(cleaned)
        return {
            **chunk,
            "key_idea": enrichment.get("key_idea", ""),
            "why_it_matters": enrichment.get("why_it_matters", ""),
            "estimated_read_time_seconds": int(
                enrichment.get("estimated_read_time_seconds")
                or _estimated_read_time(text)
            ),
        }
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"Enrichment parse failed for chunk {chunk.get('chunk_index')}: {e}")
        return chunk


def _enrich_table_chunk(chunk: dict) -> dict:
    text = chunk.get("text", "").strip()
    if not text:
        return chunk

    prompt = f"""Convert this markdown table to clean HTML.
Use only <table>, <thead>, <tbody>, <tr>, <th>, <td> tags.
Add class="table" to the <table> tag.
HTML only. No explanation, no markdown fences.

{text}"""

    html = complete(prompt, max_tokens=800)
    if html is None:
        return chunk

    cleaned_html = re.sub(r"^```[a-z]*\n?|```$", "", html.strip(), flags=re.MULTILINE)
    return {**chunk, "rendered_html": cleaned_html}


def enrich_chunks(chunks: list[dict]) -> list[dict]:
    """
    Enrich all chunks. Each chunk is processed independently so a failure
    on one never blocks the others. Images and captions are skipped.
    """
    enriched = []
    for i, chunk in enumerate(chunks):
        element_type = chunk.get("element_type", "text")
        if element_type == "image":
            enriched.append(chunk)
        elif element_type == "caption":
            enriched.append(chunk)
        elif element_type == "table":
            enriched.append(_enrich_table_chunk(chunk))
        else:
            enriched.append(_enrich_text_chunk(chunk, chunks, i))
    return enriched