import re
import logging
from typing import Literal

logger = logging.getLogger(__name__)

# How many characters a chunk can hold before we close it and start a new one.
# These are tuned for reading comfort at each guidance level.
# Heavy keeps chunks small so the user is never overwhelmed.
# Light allows longer chunks for users who need less scaffolding.
CHAR_LIMITS = {
    "heavy": 400,
    "medium": 700,
    "light": 1100,
}

# Labels that strongly indicate a section heading regardless of element_type.
# We always start a new chunk when we hit one of these.
HEADING_SIGNALS = [
    r"^\d+[\.\s]+[A-Z]",       # "1. Introduction" or "1 Introduction"
    r"^Abstract$",
    r"^References$",
    r"^Conclusion",
    r"^Discussion",
    r"^Introduction",
    r"^Methods?",
    r"^Results?",
    r"^Appendix",
    r"^Table\s+\d+",
    r"^Figure\s+\d+",
    r"^Definition\s+\d+",
    r"^Theorem\s+\d+",
    r"^Lemma\s+\d+",
    r"^Proposition\s+\d+",
    r"^Assumption\s+",
    r"^Proof\.",
]

def _is_heading(element: dict) -> bool:
    """
    Returns True if this element should always start a new chunk.
    We check both the element_type field (set by LlamaParse) and
    the text itself against known heading patterns.
    """
    if element.get("element_type") == "Title":
        return True
    text = element.get("text", "").strip()
    for pattern in HEADING_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    return False


def _is_table(element: dict) -> bool:
    """
    Returns True if this element is a markdown table.
    Tables should always be their own chunk -- never split or merged
    with surrounding prose because they need to be read as a unit.
    """
    return element.get("text", "").strip().startswith("|")


def chunk_elements(
    elements: list[dict],
    guidance_level: Literal["light", "medium", "heavy"],
) -> list[dict]:
    char_limit = CHAR_LIMITS.get(guidance_level, CHAR_LIMITS["medium"])
    chunks = []
    buffer_elements = []
    buffer_chars = 0
    chunk_index = 0

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

    for element in elements:
        # Image elements have no text -- emit them as standalone chunks
        # and never attempt to merge them with prose.
        if element.get("type") == "image":
            flush_buffer()
            chunks.append({
                "chunk_index": chunk_index,
                "elements": [element],
                "text": "",
                "page_number": element.get("page_number"),
                "element_type": "image",
                "char_count": 0,
                "is_section_start": False,
                "image_data": element.get("base64_data"),
                "image_width": element.get("width"),
                "image_height": element.get("height"),
            })
            chunk_index += 1
            continue

        text = element.get("text", "").strip()
        if not text:
            continue

        if _is_table(element):
            flush_buffer()
            chunks.append({
                "chunk_index": chunk_index,
                "elements": [element],
                "text": text,
                "page_number": element.get("page_number"),
                "element_type": "table",
                "char_count": len(text),
                "is_section_start": False,
            })
            chunk_index += 1
            continue

        if _is_heading(element):
            flush_buffer()
            chunks.append({
                "chunk_index": chunk_index,
                "elements": [element],
                "text": text,
                "page_number": element.get("page_number"),
                "element_type": "heading",
                "char_count": len(text),
                "is_section_start": True,
            })
            chunk_index += 1
            continue

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
        f"Chunked {len(elements)} elements into {len(chunks)} chunks "
        f"at guidance level '{guidance_level}'"
    )

    return chunks