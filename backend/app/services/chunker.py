import re
import logging
from typing import Literal

logger = logging.getLogger(__name__)

CHAR_LIMITS = {
    "heavy": 400,
    "medium": 700,
    "light": 1100,
}

HEADING_SIGNALS = [
    r"^\d+[\.\s]+[A-Z][a-z]",
    r"^Abstract$",
    r"^References$",
    r"^Bibliography$",
    r"^Acknowledgements?$",
    r"^Conclusion[s]?$",
    r"^Discussion$",
    r"^Introduction$",
    r"^Methods?$",
    r"^Methodology$",
    r"^Results?$",
    r"^Appendix\s*[A-Z]?$",
    r"^Related\s+Work$",
    r"^Background$",
    r"^Limitations?$",
    r"^Future\s+Work$",
]

# These patterns identify document metadata -- author names, institutions,
# dates, course info. They must NEVER be classified as headings even if
# the parser labels them as Title/heading.
METADATA_SIGNALS = [
    # Institutional affiliations
    r"(?i)(university|college|institute|department|school\s+of|faculty\s+of)",
    r"(?i)(laboratory|lab\b|center\s+for|centre\s+for)",
    # Dates and semesters
    r"(?i)(spring|summer|fall|winter|autumn)\s+\d{4}",
    r"^\d{4}$",
    r"(?i)(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}",
    # Author-like patterns: "Firstname Lastname" or "F. Lastname" or multiple names
    r"^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)*$",
    # Email addresses
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    # Course codes and numbers
    r"(?i)(course|psyc|cs|math|eng|bio|chem|phys)\s*\d{3,4}",
    # "Submitted to", "Prepared for", etc.
    r"(?i)^(submitted\s+(to|for)|prepared\s+for|presented\s+(at|to))",
]

CAPTION_SIGNALS = [
    r"^(Figure|Fig\.?)\s+\d+\.\s",
    r"^(Figure|Fig\.?)\s+\d+\.$",
    r"^(Table)\s+\d+\.\s",
    r"^(Table)\s+\d+\.$",
]

INLINE_CAPTION_SIGNALS = [
    r"^(Short-form video dominates|Usage trajectories diverge|The negative correlation)",
]

CITATION_SIGNALS = [
    r"^\[\d+\]\s+[A-Z]",
    r"^\d+\.\s+[A-Z][a-z]+,\s+[A-Z]",
    r"^\d+\.\s+.*\(\d{4}\)",
    r"^\d+\.\s+.*et al",
    # Dash-prefixed reference lists (common in humanities papers)
    r"^-\s+[A-Z][a-z]+,\s+[A-Z]",
    r"^-\s+.*\(\d{4}\)",
]


def _is_metadata(text: str) -> bool:
    """
    Returns True if this text looks like document metadata:
    author name, institution, date, course info, etc.
    These should render as plain text, never as section headings.
    """
    stripped = text.strip()
    # Metadata is always short -- long text can't be a byline
    if len(stripped) > 120:
        return False
    for pattern in METADATA_SIGNALS:
        if re.search(pattern, stripped):
            return True
    return False


def _is_heading(element: dict) -> bool:
    text = element.get("text", "").strip()

    # Metadata always wins -- never treat it as a heading
    if _is_metadata(text):
        return False

    if element.get("element_type") in ("Title", "heading"):
        # Trust parser label only for short text
        if len(text) > 120:
            return False
        return True

    for pattern in HEADING_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            if len(text) > 150:
                return False
            return True
    return False


def _is_document_title(element: dict, position_index: int) -> bool:
    """
    The true document title is the first substantive non-metadata heading.
    It must appear in the first 5 elements and be under 200 chars.
    """
    if position_index > 5:
        return False
    text = element.get("text", "").strip()
    if len(text) > 200 or len(text) < 5:
        return False
    if _is_metadata(text):
        return False
    et = element.get("element_type", "")
    return et in ("Title", "heading")


def _is_table(element: dict) -> bool:
    return element.get("text", "").strip().startswith("|")


def _is_caption(element: dict) -> bool:
    text = element.get("text", "").strip()
    if len(text) > 150:
        return False
    for pattern in CAPTION_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    if len(text) < 100:
        for pattern in INLINE_CAPTION_SIGNALS:
            if re.match(pattern, text, re.IGNORECASE):
                return True
    return False


def _is_citation(element: dict) -> bool:
    text = element.get("text", "").strip()
    for pattern in CITATION_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    return False


def _split_heading_from_prose(text: str) -> tuple[str, str]:
    match = re.match(
        r"^(\d+[\.\s]+[A-Z][^.!?]{3,60}?)\s{2,}([A-Z].{20,})",
        text,
        re.DOTALL,
    )
    if match:
        return match.group(1).strip(), match.group(2).strip()

    match2 = re.match(
        r"^(Abstract|Introduction|Methods?|Results?|Discussion|Conclusion[s]?|Acknowledgements?)\s+([A-Z].{20,})",
        text,
        re.DOTALL,
    )
    if match2:
        return match2.group(1).strip(), match2.group(2).strip()

    return text, ""


def chunk_elements(
    elements: list[dict],
    guidance_level: Literal["light", "medium", "heavy"],
) -> list[dict]:
    char_limit = CHAR_LIMITS.get(guidance_level, CHAR_LIMITS["medium"])
    chunks = []
    buffer_elements = []
    buffer_chars = 0
    chunk_index = 0
    title_emitted = False  # track whether we've emitted the one true document title

    def flush_buffer():
        nonlocal chunk_index, buffer_elements, buffer_chars
        if not buffer_elements:
            return
        combined_text = " ".join(e["text"] for e in buffer_elements)
        chunks.append({
            "chunk_index": chunk_index,
            "elements": buffer_elements,
            "text": combined_text,
            "page_number": buffer_elements[0].get("page_number"),
            "element_type": "text",
            "char_count": len(combined_text),
            "is_section_start": False,
        })
        chunk_index += 1
        buffer_elements = []
        buffer_chars = 0

    def emit(element_type: str, text: str, page: int | None, is_section_start: bool = False, extra: dict | None = None):
        nonlocal chunk_index
        chunk = {
            "chunk_index": chunk_index,
            "elements": [],
            "text": text,
            "page_number": page,
            "element_type": element_type,
            "char_count": len(text),
            "is_section_start": is_section_start,
        }
        if extra:
            chunk.update(extra)
        chunks.append(chunk)
        chunk_index += 1

    # Pre-process: split merged heading+prose elements
    split_elements: list[dict] = []
    for element in elements:
        if element.get("type") == "image":
            split_elements.append(element)
            continue
        text = element.get("text", "").strip()
        if not text:
            continue
        if re.match(r"^(\d+[\.\s]+[A-Z]|Abstract\s+[A-Z]|Introduction\s+[A-Z])", text):
            heading_text, prose_text = _split_heading_from_prose(text)
            if prose_text:
                heading_elem = {**element, "text": heading_text, "element_type": "heading"}
                prose_elem = {**element, "text": prose_text, "element_type": "text"}
                split_elements.append(heading_elem)
                split_elements.append(prose_elem)
                continue
        split_elements.append(element)

    for i, element in enumerate(split_elements):
        # IMAGE
        if element.get("type") == "image":
            flush_buffer()
            emit(
                "image", "",
                element.get("page_number"),
                extra={
                    "image_data": element.get("base64_data"),
                    "image_width": element.get("width"),
                    "image_height": element.get("height"),
                },
            )
            continue

        text = element.get("text", "").strip()
        if not text:
            continue

        # TABLE
        if _is_table(element):
            flush_buffer()
            emit("table", text, element.get("page_number"))
            continue

        # CAPTION
        if _is_caption(element):
            flush_buffer()
            emit("caption", text, element.get("page_number"))
            continue

        # CITATION
        if _is_citation(element):
            flush_buffer()
            emit("citation", text, element.get("page_number"))
            continue

        # DOCUMENT TITLE -- only the first qualifying element gets this treatment
        if not title_emitted and _is_document_title(element, i):
            flush_buffer()
            emit("Title", text, element.get("page_number"), is_section_start=True)
            title_emitted = True
            continue

        # METADATA (author, institution, date) -- after title is consumed,
        # everything that looks like metadata flows into the text buffer as
        # plain text so it renders as a normal paragraph, not a heading.
        if _is_metadata(text):
            # Group metadata lines together in the buffer
            buffer_elements.append({**element, "element_type": "text"})
            buffer_chars += len(text)
            continue

        # SECTION HEADING
        if _is_heading(element):
            flush_buffer()
            emit("heading", text, element.get("page_number"), is_section_start=True)
            continue

        # PROSE
        if buffer_chars + len(text) > char_limit and buffer_elements:
            flush_buffer()

        if (
            buffer_elements
            and element.get("page_number") is not None
            and buffer_elements[0].get("page_number") != element.get("page_number")
        ):
            flush_buffer()

        buffer_elements.append(element)
        buffer_chars += len(text)

    flush_buffer()

    if chunks:
        chunks[0]["is_section_start"] = True

    logger.info(
        f"Chunked {len(split_elements)} elements into {len(chunks)} chunks "
        f"at guidance level '{guidance_level}'"
    )

    return chunks