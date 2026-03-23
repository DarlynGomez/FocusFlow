CHUNK_METADATA_SYSTEM = """You are a helpful assistant that generates structured metadata for a chunk of text from an academic or dense document.
Output valid JSON only, with these exact keys: title, key_idea, why_it_matters, estimated_read_time_seconds.
- title: short phrase (under 80 chars) summarizing the chunk.
- key_idea: one sentence capturing the main point.
- why_it_matters: one sentence on why this matters in the document or for the reader.
- estimated_read_time_seconds: integer, typical read time for an average reader (e.g. 60-180).
"""


def chunk_metadata_user(chunk_text: str) -> str:
    return f"""Generate metadata for this chunk. Output only valid JSON.

Chunk text:
---
{chunk_text[:4000]}
---

JSON:"""
