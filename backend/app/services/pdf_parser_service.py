from __future__ import annotations
import fitz
import base64
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ImageArtifact:
    page_number: int
    image_index: int
    width: int
    height: int
    base64_data: str
    bbox: tuple[float, float, float, float]


@dataclass
class Block:
    page_number: int
    block_index: int
    text: str
    bbox: tuple[float, float, float, float]
    font_size: float | None
    block_type_guess: str


@dataclass
class PageArtifact:
    page_number: int
    width: float
    height: float
    raw_text: str
    blocks: List[Block] = field(default_factory=list)
    images: List[ImageArtifact] = field(default_factory=list)


def _infer_block_type(block: dict, font_size: float | None) -> str:
    text = (block.get("text") or "").strip()
    if not text:
        return "paragraph"
    if font_size and font_size > 12 and len(text) < 120:
        return "heading"
    if text.startswith(("•", "-", "*", "◦", "·")) or (
        len(text) < 80 and text[-1] not in ".!?"
    ):
        return "list_item"
    return "paragraph"


def _extract_images(page: fitz.Page, page_num: int) -> List[ImageArtifact]:
    """
    Extract all raster images from a single page.

    Each image is returned as a base64-encoded PNG together with its
    bounding box so it can be interleaved with text blocks in reading order.
    CMYK and multi-channel pixmaps are converted to RGB before encoding.
    Errors on individual images are caught and logged so a single corrupt
    image never aborts the parse of the whole document.
    """
    artifacts = []
    doc = page.parent

    for img_index, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        try:
            img_rects = page.get_image_rects(xref)
            bbox = tuple(img_rects[0]) if img_rects else (0.0, 0.0, 0.0, 0.0)

            base_image = doc.extract_image(xref)
            img_bytes = base_image["image"]
            img_ext = base_image["ext"]

            # Re-render non-PNG formats through a pixmap for consistent output.
            if img_ext.lower() != "png":
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_bytes = pix.tobytes("png")

            b64 = base64.b64encode(img_bytes).decode("utf-8")

            artifacts.append(ImageArtifact(
                page_number=page_num + 1,
                image_index=img_index,
                width=base_image.get("width", 0),
                height=base_image.get("height", 0),
                base64_data=b64,
                bbox=bbox,
            ))
        except Exception as e:
            print(f"[pdf_parser] Skipping image {img_index} on page {page_num + 1}: {e}")
            continue

    return artifacts


def extract_pages(file_content: bytes) -> List[PageArtifact]:
    """
    Parse every page of a PDF and return structured per-page artifacts.

    Text is extracted at the span level to preserve font-size metadata used
    for block-type inference. Images are extracted separately and attached to
    the same PageArtifact so downstream consumers have a single object per page.
    """
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
                    blocks.append(Block(
                        page_number=page_num + 1,
                        block_index=bi,
                        text=text,
                        bbox=tuple(bbox),
                        font_size=float(font_size) if font_size else None,
                        block_type_guess=block_type,
                    ))

        images = _extract_images(page, page_num)

        pages.append(PageArtifact(
            page_number=page_num + 1,
            width=rect.width,
            height=rect.height,
            raw_text=raw_text,
            blocks=blocks,
            images=images,
        ))

    doc.close()
    return pages


def extract_blocks_reading_order(pages: List[PageArtifact]) -> List[dict]:
    """
    Flatten all text blocks and images from every page into a single list
    sorted by reading order (top-to-bottom, left-to-right within each page).

    Text blocks and image artifacts are merged into the same sequence using
    their vertical bbox position as the sort key, so figures appear between
    the paragraphs they are visually positioned between in the source PDF.

    Each entry in the returned list includes a 'type' key set to either
    'text' or 'image' so downstream chunkers can handle them differently.
    """
    result = []
    order = 0

    for p in pages:
        combined: list[tuple[float, str, object]] = []

        for b in p.blocks:
            combined.append((b.bbox[1], "text", b))

        for img in p.images:
            combined.append((img.bbox[1], "image", img))

        combined.sort(key=lambda x: x[0])

        for _, item_type, item in combined:
            if item_type == "text":
                b = item
                result.append({
                    "type": "text",
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
            else:
                img = item
                result.append({
                    "type": "image",
                    "page_number": img.page_number,
                    "image_index": img.image_index,
                    "width": img.width,
                    "height": img.height,
                    "base64_data": img.base64_data,
                    "bbox_x0": img.bbox[0],
                    "bbox_y0": img.bbox[1],
                    "bbox_x1": img.bbox[2],
                    "bbox_y1": img.bbox[3],
                    "reading_order": order,
                })
            order += 1

    return result