"""Cognitive chunking: split by section/paragraph, target word count."""
from typing import List, Dict, Any

# Target ~150-350 words per chunk
TARGET_WORDS_MIN = 150
TARGET_WORDS_MAX = 350


def _word_count(text: str) -> int:
    return len(text.split())


def build_chunks(
    sections: List[Dict[str, Any]],
    target_min: int = TARGET_WORDS_MIN,
    target_max: int = TARGET_WORDS_MAX,
) -> List[Dict[str, Any]]:
    """
    Build chunk list. Each chunk has: section_title, parent_section_title, text, page_number (start/end),
    reading_order. Splits long sections by paragraph groups.
    """
    chunks: List[Dict[str, Any]] = []
    global_order = 0
    for sec in sections:
        section_title = sec.get("section_title") or ""
        blocks = sec.get("blocks", [])
        if not blocks:
            continue
        parent = blocks[0].get("parent_section_title") if blocks else None
        # Concatenate block texts for this section
        full_text = " ".join(b.get("text", "") for b in blocks)
        page_start = min(b.get("page_number", 1) for b in blocks)
        page_end = max(b.get("page_number", 1) for b in blocks)
        words = _word_count(full_text)
        if words <= target_max:
            chunks.append({
                "section_title": section_title,
                "parent_section_title": parent,
                "chunk_text": full_text.strip(),
                "page_start": page_start,
                "page_end": page_end,
                "reading_order": global_order,
            })
            global_order += 1
        else:
            # Split by paragraphs (we have blocks; each block can be a paragraph)
            acc = []
            acc_words = 0
            chunk_page_start = page_start
            chunk_page_end = page_start
            for b in blocks:
                t = b.get("text", "").strip()
                w = _word_count(t)
                if acc_words + w > target_max and acc:
                    chunk_text = " ".join(acc).strip()
                    if chunk_text and _word_count(chunk_text) >= target_min:
                        chunks.append({
                            "section_title": section_title,
                            "parent_section_title": parent,
                            "chunk_text": chunk_text,
                            "page_start": chunk_page_start,
                            "page_end": chunk_page_end,
                            "reading_order": global_order,
                        })
                        global_order += 1
                    acc = []
                    acc_words = 0
                    chunk_page_start = b.get("page_number", page_start)
                acc.append(t)
                acc_words += w
                chunk_page_end = b.get("page_number", page_end)
            if acc:
                chunk_text = " ".join(acc).strip()
                if chunk_text:
                    chunks.append({
                        "section_title": section_title,
                        "parent_section_title": parent,
                        "chunk_text": chunk_text,
                        "page_start": chunk_page_start,
                        "page_end": chunk_page_end,
                        "reading_order": global_order,
                    })
                    global_order += 1
    return chunks