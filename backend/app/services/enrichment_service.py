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


def _get_document_context(all_chunks: list[dict]) -> str:
    """
    Extract the document title and abstract to give the LLM
    global context about what the paper is arguing overall.
    This makes key ideas specific to the paper's thesis rather
    than generic descriptions of what a section contains.
    """
    lines = []
    for c in all_chunks[:8]:
        et = c.get("element_type", "")
        text = c.get("text", "").strip()
        if et in ("Title", "heading") and text:
            lines.append(f"Paper title/heading: {text}")
        elif et == "text" and len(text) > 100 and not lines:
            lines.append(f"Opening context: {text[:300]}")
        if len(lines) >= 3:
            break
    return "\n".join(lines)


def _get_local_context(all_chunks: list[dict], index: int) -> str:
    """
    Get the heading and body text immediately surrounding this chunk
    so the LLM knows exactly which section it is enriching.
    """
    lines = []
    # Look back for the most recent heading
    for i in range(index - 1, max(0, index - 5), -1):
        c = all_chunks[i]
        if c.get("element_type") in ("heading", "Title"):
            lines.append(f"Section: {c.get('text', '')}")
            break
    # Include adjacent text chunks for context
    for i in range(max(0, index - 1), min(len(all_chunks), index + 2)):
        if i == index:
            continue
        c = all_chunks[i]
        if c.get("element_type") == "text":
            lines.append(f"Adjacent text: {c.get('text', '')[:250]}")
    return "\n".join(lines)


def _enrich_text_chunk(chunk: dict, all_chunks: list[dict], index: int) -> dict:
    text = chunk.get("text", "").strip()
    if not text:
        return chunk

    doc_context = _get_document_context(all_chunks)
    local_context = _get_local_context(all_chunks, index)
    image_context = _build_image_context(all_chunks, index)
    figure_note = f"\nNearby figures:\n{image_context}" if image_context else ""

    prompt = f"""You are helping a neurodivergent student read this specific academic paper.

Paper context:
{doc_context}

Section context:
{local_context}{figure_note}

Passage to enrich:
{text[:1500]}

Your task: Write metadata that helps the student understand HOW this passage connects to the paper's overall argument and what it specifically proves or shows.

Respond with a JSON object with exactly these keys:
- "key_idea": 1-2 sentences. State the specific finding, claim, or evidence in this passage -- include actual numbers, named variables, or comparisons if present. Connect it to what the paper is trying to prove. Do NOT write "this section discusses..." or "the authors explain...".
- "why_it_matters": 1 sentence. What would a student miss if they skimmed this passage?
- "estimated_read_time_seconds": integer at 150 words per minute.

JSON only. No preamble, no markdown fences."""

    raw = complete(prompt, max_tokens=350)
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


def _enrich_table_chunk(chunk: dict, all_chunks: list[dict], index: int) -> dict:
    text = chunk.get("text", "").strip()
    if not text:
        return chunk

    doc_context = _get_document_context(all_chunks)
    local_context = _get_local_context(all_chunks, index)

    prompt = f"""You are helping a neurodivergent student read this specific academic paper.

Paper context:
{doc_context}

Section context:
{local_context}

Markdown table:
{text}

Your tasks:
1. Convert the table to clean HTML using only <table>, <thead>, <tbody>, <tr>, <th>, <td>. Add class="table" to <table>. Preserve all original column headers exactly as written -- do not rename or genericize them (never write "Metric 1", "Metric 2", etc. -- use the actual column names from the surrounding context if they are missing from the table itself).
2. Write "key_idea": 1-2 sentences identifying the most important SPECIFIC finding in this table -- name the highest/lowest/most surprising values, the winner of a comparison, or the most meaningful trend. Connect it to what this paper is trying to prove. Do not write "this table shows the performance of..." -- write what the data actually reveals.
3. Write "why_it_matters": 1 sentence on why this specific finding changes how the student should understand the paper's argument.

Respond ONLY with a JSON object with keys "html", "key_idea", "why_it_matters". No markdown fences, no preamble."""

    raw = complete(prompt, max_tokens=1200)
    if raw is None:
        return chunk

    try:
        cleaned = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned)
        return {
            **chunk,
            "rendered_html": result.get("html", ""),
            "key_idea": result.get("key_idea", ""),
            "why_it_matters": result.get("why_it_matters", ""),
        }
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"Table enrichment parse failed for chunk {chunk.get('chunk_index')}: {e}")
        # Fallback: HTML only
        html_prompt = f"""Convert this markdown table to clean HTML. Use only <table>, <thead>, <tbody>, <tr>, <th>, <td>. Add class="table" to <table>. Preserve all column names exactly. HTML only.\n\n{text}"""
        html = complete(html_prompt, max_tokens=800)
        if html:
            cleaned_html = re.sub(r"^```[a-z]*\n?|```$", "", html.strip(), flags=re.MULTILINE)
            return {**chunk, "rendered_html": cleaned_html}
        return chunk


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
            enriched.append(_enrich_table_chunk(chunk, chunks, i))
        else:
            enriched.append(_enrich_text_chunk(chunk, chunks, i))
    return enriched