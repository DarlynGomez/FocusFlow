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
    global context. Skips metadata chunks (author, institution, date)
    which are now typed as 'text' but are short and appear before
    the first real heading.
    """
    lines = []
    found_title = False
    for c in all_chunks[:12]:
        et = c.get("element_type", "")
        text = c.get("text", "").strip()
        if not text:
            continue
        # The document title is the one 'Title' typed chunk
        if et == "Title" and not found_title:
            lines.append(f"Paper title: {text}")
            found_title = True
            continue
        # First real section heading after title (Abstract, Introduction)
        if et == "heading" and found_title:
            lines.append(f"Section: {text}")
        # First substantive body paragraph (likely abstract body)
        if et == "text" and len(text) > 150 and len(lines) < 3:
            lines.append(f"Opening context: {text[:400]}")
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

    prompt = f"""You are helping a neurodivergent student deeply understand an academic paper.

Paper context:
{doc_context}

Section context:
{local_context}{figure_note}

Passage to enrich:
{text[:1500]}

Your task: Write metadata that connects this passage to the paper's larger argument and real-world significance.

Respond with a JSON object with exactly these keys:

- "key_idea": 1-2 sentences. State the specific finding, claim, or evidence in this passage. Include actual numbers, named variables, or comparisons if present. Start with what the passage PROVES or SHOWS, not what it "discusses" or "presents". Never start with "This section" or "The authors".

- "why_it_matters": 1-2 sentences. Explain the INTELLECTUAL CONSEQUENCE of this finding — how it reframes the way we think about the topic, what assumption it challenges, what it makes possible, or how it advances the paper's central argument. Do NOT say "a student might miss" or "this is important because". Do NOT restate the key idea. Connect to the research goal or a real-world implication. Think: what changes in how you understand the world if this finding is true?

- "estimated_read_time_seconds": integer at 150 words per minute.

Examples of GOOD why_it_matters:
- "This reframes studying as a timing problem rather than an effort problem, directly challenging the assumption that cramming is ineffective only because of fatigue."
- "By achieving 97.7%% of centralized performance while guaranteeing privacy, this result collapses the assumed trade-off between data utility and patient protection that has blocked hospital collaboration for decades."
- "This shifts the design question from 'does spaced repetition work' to 'how do we build systems that make it the default' — a fundamentally different problem with different institutional solutions."

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


def _enrich_heading_chunk(chunk: dict, all_chunks: list[dict], index: int) -> dict:
    """
    For major section headings, generate a micro-assessment question
    that tests conceptual understanding of that section's content.
    The question is stored on the heading chunk and displayed after
    the reader scrolls past the section.
    """
    heading_text = chunk.get("text", "").strip()
    if not heading_text:
        return chunk

    # Collect the body text of this section (chunks after this heading
    # until the next heading) to give the LLM section content to work with
    section_body_parts = []
    for i in range(index + 1, min(len(all_chunks), index + 10)):
        c = all_chunks[i]
        if c.get("element_type") in ("heading", "Title"):
            break
        if c.get("element_type") == "text":
            section_body_parts.append(c.get("text", "")[:600])

    section_body = "\n\n".join(section_body_parts[:3])
    if not section_body.strip():
        return chunk

    doc_context = _get_document_context(all_chunks)

    prompt = f"""You are designing a micro-assessment for a neurodivergent student who just finished reading a section of an academic paper.

Paper context:
{doc_context}

Section heading: {heading_text}

Section content:
{section_body[:1800]}

Your task: Write one short-answer question that tests whether the student understood the CONCEPTUAL meaning of this section — not surface recall of facts, but whether they grasped the argument or finding.

Rules:
- The question must be answerable in 1-3 sentences
- It must require understanding, not just memory (avoid "what was the sample size")
- It should connect the section to the paper's broader argument
- The ideal answer should demonstrate the student understood WHY, not just WHAT

Respond with a JSON object with exactly these keys:
- "question": the question string (1 sentence)
- "ideal_answer": a model answer in 2-3 sentences that would indicate full understanding. Be specific — include key concepts, any important numbers, and the connection to the paper's argument.

JSON only. No preamble, no markdown fences."""

    raw = complete(prompt, max_tokens=300)
    if raw is None:
        return chunk

    try:
        cleaned = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip(), flags=re.MULTILINE)
        result = json.loads(cleaned)
        return {
            **chunk,
            "assessment_question": result.get("question", ""),
            "assessment_answer": result.get("ideal_answer", ""),
        }
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        logger.warning(f"Assessment generation failed for chunk {chunk.get('chunk_index')}: {e}")
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


# Sections worth assessing
ASSESSABLE_HEADINGS = {
    "abstract", "introduction", "background", "related work",
    "methods", "methodology", "results", "discussion",
    "conclusion", "conclusions", "limitations", "future work",
}

def _is_assessable_heading(chunk: dict) -> bool:
    text = chunk.get("text", "").strip().lower()
    # Match exact names or numbered sections
    import re
    clean = re.sub(r"^\d+[\.\s]+", "", text).strip()
    return any(clean == h or clean.startswith(h) for h in ASSESSABLE_HEADINGS)


def enrich_chunks(chunks: list[dict]) -> list[dict]:
    enriched = []
    for i, chunk in enumerate(chunks):
        element_type = chunk.get("element_type", "text")
        if element_type == "image":
            enriched.append(chunk)
        elif element_type == "caption":
            enriched.append(chunk)
        elif element_type == "table":
            enriched.append(_enrich_table_chunk(chunk, chunks, i))
        elif element_type == "heading" and _is_assessable_heading(chunk):
            enriched.append(_enrich_heading_chunk(chunk, chunks, i))
        else:
            enriched.append(_enrich_text_chunk(chunk, chunks, i))
    return enriched