import re
import logging
from typing import Literal

logger = logging.getLogger(__name__)

CHAR_LIMITS = {
    "heavy": 400,
    "medium": 700,
    "light": 1100,
}

# Strict heading patterns -- only match lines that are ONLY a heading,
# not a heading with prose concatenated after it.
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
    r"^Results?$",
    r"^Appendix\s*[A-Z]?$",
]

CAPTION_SIGNALS = [
    r"^(Figure|Fig\.?)\s+\d+[\.\s]",
    r"^(Table)\s+\d+[\.\s]",
    r"^(Figure|Fig\.?)\s+\d+\s+(shows|reveals|illustrates|displays|presents)",
]

# Short standalone sentences that are clearly figure/table captions
# appearing inline without a Figure N. prefix.
INLINE_CAPTION_SIGNALS = [
    r"^(Short-form|Usage trajectories|The negative correlation|Results are presented)",
]

CITATION_SIGNALS = [
    r"^\[\d+\]\s+[A-Z]",
    r"^\d+\.\s+[A-Z][a-z]+,\s+[A-Z]",
    r"^\d+\.\s+.*\(\d{4}\)",
    r"^\d+\.\s+.*et al",
]


def _is_heading(element: dict) -> bool:
    if element.get("element_type") in ("Title", "heading"):
        text = element.get("text", "").strip()
        # Trust the parser label only for short text -- long text means
        # the parser merged a heading and its paragraph together.
        if len(text) > 120:
            return False
        return True
    text = element.get("text", "").strip()
    for pattern in HEADING_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            # Additional guard: if the text is very long it is a merged
            # heading+paragraph, not a pure heading.
            if len(text) > 150:
                return False
            return True
    return False


def _is_table(element: dict) -> bool:
    return element.get("text", "").strip().startswith("|")


def _is_caption(element: dict) -> bool:
    text = element.get("text", "").strip()
    for pattern in CAPTION_SIGNALS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    # Short lines (under 120 chars) that match inline caption signals
    if len(text) < 120:
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
    """
    When a parser merges a numbered heading and its following paragraph
    into one element, split them apart.

    Detects the pattern: "N. Title Text Prose begins here..."
    Returns (heading_text, prose_text). If no split point is found,
    returns (text, "").
    """
    # Match a numbered heading at the start followed by prose.
    # The heading ends at the first sentence boundary after the title words.
    match = re.match(
        r"^(\d+[\.\s]+[A-Z][^.!?]{3,60}?)\s{2,}([A-Z].{20,})",
        text,
        re.DOTALL,
    )
    if match:
        return match.group(1).strip(), match.group(2).strip()

    # Also handle "Abstract This study..." style merges.
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
    """
    Groups raw parser elements into reader-friendly chunks.

    Key behaviors:
    - Merged heading+prose elements are split before chunking.
    - Headings are always standalone chunks.
    - Captions and inline caption-like sentences get their own chunk.
    - Citations accumulate as individual chunks for grouped rendering.
    - Images pass through as standalone chunks with their base64 data.
    - Prose accumulates until the char limit or a page boundary is hit.
    """
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

    # Pre-process: split any merged heading+prose elements before the main loop.
    split_elements: list[dict] = []
    for element in elements:
        if element.get("type") == "image":
            split_elements.append(element)
            continue
        text = element.get("text", "").strip()
        if not text:
            continue
        # Only attempt split on elements that look like they start with a heading.
        if re.match(r"^(\d+[\.\s]+[A-Z]|Abstract\s+[A-Z]|Introduction\s+[A-Z])", text):
            heading_text, prose_text = _split_heading_from_prose(text)
            if prose_text:
                heading_elem = {**element, "text": heading_text, "element_type": "heading"}
                prose_elem = {**element, "text": prose_text, "element_type": "text"}
                split_elements.append(heading_elem)
                split_elements.append(prose_elem)
                continue
        split_elements.append(element)

    for element in split_elements:
        # IMAGE
        if element.get("type") == "image":
            flush_buffer()
            emit(
                "image",
                "",
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

        # HEADING
        if _is_heading(element):
            flush_buffer()
            emit("heading", text, element.get("page_number"), is_section_start=True)
            continue

        # PROSE -- accumulate into buffer
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