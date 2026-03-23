"""Infer sections and merge blocks for chunking. No LLM; deterministic."""
from typing import List, Dict, Any


def infer_structure(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Tag blocks with section boundaries. Use heading blocks to start new sections.
    Add section_title to each block (current section), parent_section_title for hierarchy.
    """
    section_stack: List[str] = []
    result = []
    for b in blocks:
        bt = b.get("block_type_guess") or "paragraph"
        text = (b.get("text") or "").strip()
        if bt == "heading" and text:
            # New section: push or replace
            if section_stack:
                section_stack.pop()
            section_stack.append(text)
        current_section = section_stack[-1] if section_stack else None
        parent = section_stack[-2] if len(section_stack) >= 2 else None
        result.append({
            **b,
            "section_title": current_section,
            "parent_section_title": parent,
        })
    return result


def normalize_blocks(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge consecutive paragraphs that are same section into logical blocks for chunking."""
    if not blocks:
        return []
    out = []
    buf: List[str] = []
    current_section = None
    group_first: Dict[str, Any] = {}
    for b in blocks:
        section = b.get("section_title")
        text = (b.get("text") or "").strip()
        if not text:
            continue
        if section != current_section and buf:
            out.append({
                "text": " ".join(buf),
                "section_title": current_section,
                "parent_section_title": group_first.get("parent_section_title"),
                "block_type_guess": "paragraph",
                "reading_order": group_first.get("reading_order", len(out)),
                "page_number": group_first.get("page_number"),
            })
            buf = []
        current_section = section
        if not buf:
            group_first = b
        buf.append(text)
    if buf:
        out.append({
            "text": " ".join(buf),
            "section_title": current_section,
            "parent_section_title": group_first.get("parent_section_title"),
            "block_type_guess": "paragraph",
            "reading_order": group_first.get("reading_order", len(out)),
            "page_number": group_first.get("page_number"),
        })
    return out


def build_sections(normalized: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group normalized blocks by section for chunking. Return list of sections with blocks in reading order."""
    from collections import OrderedDict
    sections: OrderedDict[str, List[Dict]] = OrderedDict()
    for blk in normalized:
        sec = blk.get("section_title") or "_no_section"
        if sec not in sections:
            sections[sec] = []
        sections[sec].append(blk)
    return [{"section_title": k, "blocks": v} for k, v in sections.items()]
