"""Layout-aware PDF parsing with PyMuPDF. Extracts blocks, order, and structure."""
from __future__ import annotations
import fitz
from dataclasses import dataclass, field
from typing import List


@dataclass
class Block:
    page_number: int
    block_index: int
    text: str
    bbox: tuple[float, float, float, float]
    font_size: float | None
    block_type_guess: str  # heading, paragraph, list_item, caption, etc.


@dataclass
class PageArtifact:
    page_number: int
    width: float
    height: float
    raw_text: str
    blocks: List[Block] = field(default_factory=list)


def _infer_block_type(block: dict, font_size: float | None) -> str:
    text = (block.get("text") or "").strip()
    if not text:
        return "paragraph"
    # Short lines with larger font or at top of page -> heading
    if font_size and font_size > 12 and len(text) < 120:
        return "heading"
    if text.startswith(("•", "-", "*", "◦", "·")) or (
        len(text) < 80 and text[-1] not in ".!?"
    ):
        return "list_item"
    return "paragraph"


def extract_pages(file_content: bytes) -> List[PageArtifact]:
    """Extract per-page text and blocks in reading order."""
    doc = fitz.open(stream=file_content, filetype="pdf")
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        rect = page.rect
        raw_text = page.get_text()
        blocks = []
        block_list = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        for bi, b in enumerate(block_list):
            for line in b.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    font_size = span.get("size")
                    bbox = span.get("bbox", (0, 0, 0, 0))
                    block_type = _infer_block_type({"text": text}, font_size)
                    blocks.append(
                        Block(
                            page_number=page_num + 1,
                            block_index=bi,
                            text=text,
                            bbox=tuple(bbox),
                            font_size=float(font_size) if font_size else None,
                            block_type_guess=block_type,
                        )
                    )
        # Merge spans that belong to same line/block for cleaner chunks later
        pages.append(
            PageArtifact(
                page_number=page_num + 1,
                width=rect.width,
                height=rect.height,
                raw_text=raw_text,
                blocks=blocks,
            )
        )
    doc.close()
    return pages


def extract_blocks_reading_order(pages: List[PageArtifact]) -> List[dict]:
    """Flatten blocks with global reading order (page then top-to-bottom, left-to-right)."""
    result = []
    order = 0
    for p in pages:
        # Sort by bbox y then x
        sorted_blocks = sorted(
            p.blocks,
            key=lambda b: (b.bbox[1], b.bbox[0]),
        )
        for b in sorted_blocks:
            result.append({
                "page_number": b.page_number,
                "block_index": b.block_index,
                "text": b.text,
                "bbox_x0": b.bbox[0],
                "bbox_y0": b.bbox[1],
                "bbox_x1": b.bbox[2],
                "bbox_y1": b.bbox[3],
                "font_size_guess": b.font_size,
                "block_type_guess": b.block_type_guess,
                "reading_order": order,
            })
            order += 1
    return result