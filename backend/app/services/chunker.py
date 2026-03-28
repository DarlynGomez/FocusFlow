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
    """
    Groups raw parser elements into reader-friendly chunks.

    Each chunk is a dict with:
      - chunk_index: int, position in the reading sequence (0-based)
      - elements: list of the raw elements that were merged into this chunk
      - text: the combined readable text of all elements in this chunk
      - page_number: the page where this chunk starts
      - element_type: "heading", "table", or "text"
      - char_count: total characters in the chunk
      - is_section_start: True if this chunk begins a new document section

    Strategy:
      1. Headings always start a new chunk and are never merged with prose.
      2. Tables are always their own standalone chunk.
      3. Prose elements are accumulated into a buffer until the char limit
         is reached, then flushed as a chunk.
      4. A page boundary also flushes the buffer so chunks never span pages.
         This matters for the AI panel which needs to know what page context
         to pass to the LLM.
    """
    char_limit = CHAR_LIMITS.get(guidance_level, CHAR_LIMITS["medium"])
    chunks = []
    buffer_elements = []
    buffer_chars = 0
    chunk_index = 0

    def flush_buffer():
        """
        Takes whatever is in the buffer and commits it as a finished chunk.
        Modifies chunk_index, chunks, buffer_elements, and buffer_chars
        via nonlocal so the outer loop can call it cleanly.
        """
        nonlocal chunk_index, buffer_elements, buffer_chars

        if not buffer_elements:
            return

        # Join all buffered element texts with a space between them.
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
        text = element.get("text", "").strip()
        if not text:
            continue

        # Tables are always standalone chunks -- flush anything in the buffer
        # first, then emit the table as its own chunk, then continue.
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

        # Headings always start a new chunk. Flush what came before,
        # then emit the heading as its own standalone chunk.
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

        # If adding this element would push the buffer over the char limit,
        # flush first so the new element starts a fresh chunk.
        if buffer_chars + len(text) > char_limit and buffer_elements:
            flush_buffer()

        # If this element is on a different page than what is in the buffer,
        # flush before adding it so chunks never span page boundaries.
        if (
            buffer_elements
            and element.get("page_number") is not None
            and buffer_elements[0].get("page_number") != element.get("page_number")
        ):
            flush_buffer()

        buffer_elements.append(element)
        buffer_chars += len(text)

    # After the loop, flush anything remaining in the buffer.
    flush_buffer()

    # Mark the very first chunk as a section start regardless of its type
    # so the reading view knows to show the document title context.
    if chunks:
        chunks[0]["is_section_start"] = True

    logger.info(
        f"Chunked {len(elements)} elements into {len(chunks)} chunks "
        f"at guidance level '{guidance_level}'"
    )

    return chunks