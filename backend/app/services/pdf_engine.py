# backend/app/services/pdf_engine.py

import pdfplumber
import re
import os
import logging
from typing import Optional

from app.config import get_llama_api_key, llama_api_key_is_configured


logger = logging.getLogger(__name__)


def classify_pdf(filepath: str) -> dict:
    """
    Lightweight pre-scan of the PDF to decide which parser to use.
    Only samples the first 3 pages so this stays fast.
    Returns the recommended parser and the reasoning behind the choice.
    """

    result = {
        "parser": "pdfplumber",
        "reasons": [],
        "signals": {}
    }

    try:
        with pdfplumber.open(filepath) as pdf:
            total_pages = len(pdf.pages)
            sample_pages = pdf.pages[:min(3, total_pages)]

            total_chars = 0
            total_images = 0
            empty_page_count = 0
            cid_count = 0

            for page in sample_pages:
                text = page.extract_text() or ""
                total_chars += len(text)

                # Count how many (cid:N) placeholder tokens appear in the extracted text.
                # These are characters pdfplumber cannot decode -- math symbols, special glyphs.
                # A high count means the PDF has encoding that pdfplumber cannot handle.
                cid_count += len(re.findall(r'\(cid:\d+\)', text))

                if hasattr(page, "images"):
                    total_images += len(page.images)

                if len(text.strip()) == 0:
                    empty_page_count += 1

            chars_per_page = (
                total_chars / len(sample_pages) if sample_pages else 0
            )

            # Math density heuristic: look for patterns that strongly suggest LaTeX math.
            # We sample the raw text of the first page specifically for this.
            first_page_text = pdf.pages[0].extract_text() or ""

            # These are patterns that appear when pdfplumber extracts math-heavy PDFs:
            # Greek letters, nabla/norm operators, subscript runs, fraction-like tokens.
            math_patterns = [
                r'\\[a-zA-Z]+',          # LaTeX command remnants like \theta
                r'\(cid:\d+\)',           # Unrenderable glyph placeholders
                r'[∇∑∏∫√∞≤≥≠±∈∉⊆∥]',   # Common math Unicode symbols
                r'\b[A-Z]_\{?[a-z0-9]+\}?',  # Variable subscripts like A_{ij}
                r'\d+/\d+',              # Inline fractions
            ]

            math_signal_count = sum(
                len(re.findall(pattern, first_page_text))
                for pattern in math_patterns
            )

            result["signals"] = {
                "total_pages": total_pages,
                "chars_sampled": total_chars,
                "chars_per_page": round(chars_per_page, 1),
                "images_found": total_images,
                "empty_pages_in_sample": empty_page_count,
                "cid_tokens_found": cid_count,
                "math_signals": math_signal_count,
                "llama_available": llama_api_key_is_configured(),
            }

            # No text at all -- scanned document
            if total_chars == 0 or empty_page_count == len(sample_pages):
                result["parser"] = "llamaparse"
                result["reasons"].append(
                    "No text layer detected -- document appears to be scanned or image-based"
                )
                return result

            # Very sparse text
            if chars_per_page < 100:
                result["parser"] = "llamaparse"
                result["reasons"].append(
                    f"Very low text density ({total_chars} chars across "
                    f"{len(sample_pages)} pages)"
                )
                return result

            # High image density
            if total_images > len(sample_pages) * 2:
                result["parser"] = "llamaparse"
                result["reasons"].append(
                    f"High image density ({total_images} images across "
                    f"{len(sample_pages)} pages)"
                )
                return result

            # Math/equation heavy document detection.
            # If we see more than 5 (cid:N) tokens OR more than 10 math signals across
            # the sampled pages, pdfplumber will produce shattered unusable output.
            # Route to LlamaParse which handles LaTeX-rendered PDFs properly.
            if cid_count > 5 or math_signal_count > 10:
                result["parser"] = "llamaparse"
                result["reasons"].append(
                    f"Math/equation-heavy content detected "
                    f"({cid_count} unrenderable glyph tokens, "
                    f"{math_signal_count} math symbol signals)"
                )
                return result

            # Two-column layout detection
            first_page = pdf.pages[0]
            words = first_page.extract_words()

            if words:
                page_width = first_page.width
                center = page_width / 2
                margin = page_width * 0.05

                left_words = [w for w in words if w["x1"] < center - margin]
                right_words = [w for w in words if w["x0"] > center + margin]

                left_ratio = len(left_words) / len(words)
                right_ratio = len(right_words) / len(words)

                if left_ratio > 0.3 and right_ratio > 0.3:
                    result["parser"] = "llamaparse"
                    result["reasons"].append(
                        f"Two-column layout detected "
                        f"({left_ratio:.0%} left, {right_ratio:.0%} right of words)"
                    )
                    return result

            result["reasons"].append(
                "Standard single-column text PDF -- fast parser is sufficient"
            )

    except Exception as e:
        logger.warning(f"Classification failed: {e} -- defaulting to llamaparse")
        result["parser"] = "llamaparse"
        result["reasons"].append(
            f"Classification failed ({str(e)}) -- defaulting to deep parser"
        )

    return result


# Parsers
def _parse_with_pdfplumber(filepath: str) -> dict:
    """
    Fast local parser for standard single-column text PDFs.
    Filters out broken equation fragments, page numbers, and encoding artifacts
    before returning elements.
    """

    # Patterns that identify junk fragments we should discard.
    # These appear when pdfplumber partially extracts math or badly encoded text.
    JUNK_PATTERNS = [
        re.compile(r'^\(cid:\d+\)[\s\(cid:\d+\)]*$'),  # Pure (cid:N) placeholder lines
        re.compile(r'^[∗†‡§¶]+$'),                       # Lone footnote markers
        re.compile(r'^[\d\s\.,\+\-\*\/\=]+$'),           # Lines of only numbers/operators
        re.compile(r'^[a-zA-Z\s]{1,3}$'),                # Very short fragments (1-3 chars)
        re.compile(r'^\W+$'),                             # Lines of only punctuation/symbols
    ]

    def is_junk(text: str) -> bool:
        """Returns True if this fragment is too broken or short to be useful content."""
        stripped = text.strip()
        if len(stripped) < 4:
            return True
        for pattern in JUNK_PATTERNS:
            if pattern.match(stripped):
                return True
        return False

    elements = []

    try:
        with pdfplumber.open(filepath) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()

                if not text or not text.strip():
                    logger.debug(f"Page {page_num + 1} returned no text from pdfplumber")
                    continue

                # Split on double newlines first, then fall back to single newlines.
                if "\n\n" in text:
                    raw_paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
                else:
                    raw_paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

                # Stitch consecutive short lines together.
                # pdfplumber often splits a single sentence across multiple lines because
                # each PDF text object is its own extraction unit. We merge lines that
                # don't end with sentence-ending punctuation into the next line.
                stitched = []
                buffer = ""

                for para in raw_paragraphs:
                    if is_junk(para):
                        # If we have content in the buffer, flush it before skipping junk.
                        if buffer:
                            stitched.append(buffer.strip())
                            buffer = ""
                        continue

                    if buffer:
                        # If the buffer doesn't end with sentence-ending punctuation,
                        # treat this line as a continuation and join with a space.
                        if not re.search(r'[.!?:]\s*$', buffer):
                            buffer = buffer + " " + para
                        else:
                            stitched.append(buffer.strip())
                            buffer = para
                    else:
                        buffer = para

                # Flush whatever is left in the buffer after the loop ends.
                if buffer:
                    stitched.append(buffer.strip())

                for para in stitched:
                    # Final check: skip anything that is still too short after stitching.
                    if len(para) < 10:
                        continue

                    elements.append({
                        "text": para,
                        "element_type": "text",
                        "page_number": page_num + 1,
                        "char_count": len(para),
                    })

    except Exception as e:
        raise RuntimeError(f"pdfplumber extraction failed: {str(e)}")

    return {"elements": elements, "fallback_warning": None}


def _parse_with_llamaparse(filepath: str) -> dict:
    """
    Deep parser for scanned documents, two-column layouts, image-heavy, and math PDFs.
    Requires LLAMA_CLOUD_API_KEY in the .env file.
    Falls back to pdfplumber (with stitching) if the key is missing, the API fails,
    or the response is empty.
    """

    api_key = get_llama_api_key()
    if not api_key or not api_key.strip():
        logger.warning(
            "LlamaParse was selected but LLAMA_CLOUD_API_KEY is not set in .env. "
            "Falling back to pdfplumber."
        )
        fallback_result = _parse_with_pdfplumber(filepath)
        fallback_result["fallback_warning"] = (
            "This document type works best with our deep parser, but it is not "
            "configured yet. Results may be less accurate for complex layouts."
        )
        return fallback_result

    try:
        from llama_parse import LlamaParse
        import asyncio
        import concurrent.futures

        parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            verbose=False,
        )

        def run_llamaparse():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(parser.aload_data(filepath))
            finally:
                loop.close()

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_llamaparse)
            documents = future.result(timeout=120)

        if not documents:
            logger.warning("LlamaParse returned empty documents -- falling back to pdfplumber")
            fallback_result = _parse_with_pdfplumber(filepath)
            fallback_result["fallback_warning"] = (
                "Deep parsing returned no content. Basic extraction was used instead."
            )
            return fallback_result

        elements = []
        for page_num, doc in enumerate(documents):
            if not doc.text.strip():
                continue

            blocks = [b.strip() for b in doc.text.split("\n\n") if b.strip()]

            # Stitch consecutive short blocks together the same way we do for pdfplumber.
            # LlamaParse markdown can also split a single paragraph across multiple blocks
            # especially for wrapped text in two-column layouts.
            stitched_blocks = []
            buffer = ""

            for block in blocks:
                # Markdown headings always stand alone -- never merge them.
                if block.startswith("#"):
                    if buffer:
                        stitched_blocks.append(buffer.strip())
                        buffer = ""
                    stitched_blocks.append(block)
                    continue

                # Markdown table rows also stand alone.
                if block.startswith("|"):
                    if buffer:
                        stitched_blocks.append(buffer.strip())
                        buffer = ""
                    stitched_blocks.append(block)
                    continue

                if buffer:
                    if not re.search(r'[.!?:]\s*$', buffer):
                        buffer = buffer + " " + block
                    else:
                        stitched_blocks.append(buffer.strip())
                        buffer = block
                else:
                    buffer = block

            if buffer:
                stitched_blocks.append(buffer.strip())

            for block in stitched_blocks:
                # Skip blocks that are too short to be meaningful content.
                if len(block.strip()) < 10:
                    continue

                if block.startswith("#"):
                    element_type = "Title"
                    clean_text = block.lstrip("#").strip()
                else:
                    element_type = "text"
                    clean_text = block

                elements.append({
                    "text": clean_text,
                    "element_type": element_type,
                    "page_number": page_num + 1,
                    "char_count": len(clean_text),
                })

        return {"elements": elements, "fallback_warning": None}

    except ImportError:
        logger.error("llama-parse is not installed. Run: pip install llama-parse")
        fallback_result = _parse_with_pdfplumber(filepath)
        fallback_result["fallback_warning"] = (
            "Deep parser package is not installed. Basic extraction was used instead."
        )
        return fallback_result

    except Exception as e:
        logger.error(f"LlamaParse failed: {e} -- falling back to pdfplumber")
        fallback_result = _parse_with_pdfplumber(filepath)
        fallback_result["fallback_warning"] = (
            "Deep parsing encountered an error and basic extraction was used instead. "
            "Results may be less accurate for complex layouts."
        )
        return fallback_result


def parse_pdf_smart(filepath: str) -> dict:
    """
    The only function the endpoint calls.
    Classifies the document, picks the right parser, runs it,
    and evaluates the output quality before returning.
    """

    classification = classify_pdf(filepath)
    chosen_parser = classification["parser"]

    logger.info(f"Parser selected: {chosen_parser} | Reasons: {classification['reasons']}")

    if chosen_parser == "llamaparse" and not llama_api_key_is_configured():
        logger.info(
            "Classifier selected llamaparse but key is not configured -- "
            "overriding to pdfplumber"
        )
        chosen_parser = "pdfplumber"
        classification["reasons"].append(
            "LlamaParse key not configured -- using fast parser instead"
        )

    if chosen_parser == "llamaparse":
        parse_result = _parse_with_llamaparse(filepath)
    else:
        parse_result = _parse_with_pdfplumber(filepath)

    elements = parse_result["elements"]
    fallback_warning = parse_result.get("fallback_warning")

    total_chars = sum(e["char_count"] for e in elements)
    low_text_warning = total_chars < 200

    if fallback_warning:
        warning_message = fallback_warning
    elif low_text_warning:
        warning_message = (
            "Very little text was extracted from this document. "
            "It may be a scanned image PDF. Try uploading a text-based version if available."
        )
    else:
        warning_message = None

    return {
        "classification": classification,
        "elements": elements,
        "low_text_warning": low_text_warning,
        "warning_message": warning_message,
    }