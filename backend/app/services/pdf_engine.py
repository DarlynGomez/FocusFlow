import pdfplumber
import os
import logging
import nest_asyncio
from typing import Optional

from app.config import get_llama_api_key, llama_api_key_is_configured

# Apply at module load so LlamaParse can run inside FastAPI's event loop
nest_asyncio.apply()

logger = logging.getLogger(__name__)


# Classifier
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

            # Only sample first 3 pages to keep classification fast
            sample_pages = pdf.pages[:min(3, total_pages)]

            total_chars = 0
            total_images = 0
            empty_page_count = 0

            for page in sample_pages:
                text = page.extract_text() or ""
                total_chars += len(text)

                if hasattr(page, "images"):
                    total_images += len(page.images)

                if len(text.strip()) == 0:
                    empty_page_count += 1

            chars_per_page = (
                total_chars / len(sample_pages) if sample_pages else 0
            )

            result["signals"] = {
                "total_pages": total_pages,
                "chars_sampled": total_chars,
                "chars_per_page": round(chars_per_page, 1),
                "images_found": total_images,
                "empty_pages_in_sample": empty_page_count,
                "llama_available": llama_api_key_is_configured(),
            }

            # Check all edge cases
            # No text at all likely a scanned document
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

            # Too many images relative to pages
            if total_images > len(sample_pages) * 2:
                result["parser"] = "llamaparse"
                result["reasons"].append(
                    f"High image density ({total_images} images across "
                    f"{len(sample_pages)} pages)"
                )
                return result

            # Two column layout detection
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

            # No override triggered standard document is fine with pdfplumber
            result["reasons"].append(
                "Standard single-column text PDF -- fast parser is sufficient"
            )

    except Exception as e:
        # If classification itself crashes default to llamaparse as the safer option
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
    No API key required, runs entirely locally.
    """

    elements = []

    try:
        with pdfplumber.open(filepath) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()

                if not text or not text.strip():
                    # Page has no text layer, skip it rather than crash
                    logger.debug(f"Page {page_num + 1} returned no text from pdfplumber")
                    continue

                # Split on double newlines to get paragraph level blocks
                # Abigail's chunker handles finer splitting downstream
                paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

                for para in paragraphs:
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
    Deep parser for scanned documents, two-column layouts, and image-heavy PDFs.
    Requires LLAMA_CLOUD_API_KEY in the .env file.
    Falls back to pdfplumber if the key is missing, the API fails, or the response is empty.
    """

    # Check the key before making any network call
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

        parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            verbose=False,
        )

        documents = parser.load_data(filepath)

        # Empty response from LlamaParse, fall back rather than return nothing
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

            for block in blocks:
                # LlamaParse markdown headings start with # so classify them as Title
                # so the chunker knows to keep them attached to what follows
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
        # Package not installed
        logger.error("llama-parse is not installed. Run: pip install llama-parse")
        fallback_result = _parse_with_pdfplumber(filepath)
        fallback_result["fallback_warning"] = (
            "Deep parser package is not installed. Basic extraction was used instead."
        )
        return fallback_result

    except Exception as e:
        # Network error, auth error, timeout, anything unexpected from LlamaParse
        logger.error(f"LlamaParse failed: {e} -- falling back to pdfplumber")
        fallback_result = _parse_with_pdfplumber(filepath)
        fallback_result["fallback_warning"] = (
            "Deep parsing encountered an error and basic extraction was used instead. "
            "Results may be less accurate for complex layouts."
        )
        return fallback_result


# Router
def parse_pdf_smart(filepath: str) -> dict:
    """
    The only function the endpoint calls.
    Classifies the document, picks the right parser, runs it,
    and evaluates the output quality before returning.
    """

    # Classify first
    classification = classify_pdf(filepath)
    chosen_parser = classification["parser"]

    logger.info(f"Parser selected: {chosen_parser} | Reasons: {classification['reasons']}")

    # If llamaparse was chosen but the key is not configured override now
    if chosen_parser == "llamaparse" and not llama_api_key_is_configured():
        logger.info(
            "Classifier selected llamaparse but key is not configured -- "
            "overriding to pdfplumber"
        )
        chosen_parser = "pdfplumber"
        classification["reasons"].append(
            "LlamaParse key not configured -- using fast parser instead"
        )

    # Route to the right parser
    if chosen_parser == "llamaparse":
        parse_result = _parse_with_llamaparse(filepath)
    else:
        parse_result = _parse_with_pdfplumber(filepath)

    elements = parse_result["elements"]
    fallback_warning = parse_result.get("fallback_warning")

    # Evaluate output quality
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