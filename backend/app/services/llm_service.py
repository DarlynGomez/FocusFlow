from __future__ import annotations
import logging
from typing import Optional
import anthropic
from app.config import anthropic_api_key, chat_model

logger = logging.getLogger(__name__)

_client: Optional[anthropic.Anthropic] = None


def get_client() -> Optional[anthropic.Anthropic]:
    """
    Return a shared Anthropic client, or None if no API key is configured.
    The client is constructed once and reused for all subsequent calls.
    """
    global _client
    if _client is not None:
        return _client
    if not anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY is not set -- LLM features are disabled")
        return None
    _client = anthropic.Anthropic(api_key=anthropic_api_key)
    return _client


def complete(
    prompt: str,
    system: str = "",
    max_tokens: int = 1000,
    model: Optional[str] = None,
) -> Optional[str]:
    """
    Send a single-turn completion request and return the text response.
    Returns None if the client is unavailable or the request fails so
    callers can fall back gracefully without try/except boilerplate.
    """
    client = get_client()
    if client is None:
        return None
    try:
        response = client.messages.create(
            model=model or chat_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text if response.content else None
    except Exception as e:
        logger.error(f"LLM completion failed: {e}")
        return None



def chat_completion(
    messages: list[dict],
    max_tokens: int = 1000,
    model: Optional[str] = None,
) -> str:
    """
    Adapter so support_generation_service can call chat_completion(messages=[...])
    without knowing about the underlying complete() signature.
    Extracts system and user content from the messages list.
    """
    system = ""
    user_parts = []
    for msg in messages:
        if msg["role"] == "system":
            system = msg["content"]
        else:
            user_parts.append(msg["content"])

    prompt = "\n\n".join(user_parts)
    result = complete(prompt=prompt, system=system, max_tokens=max_tokens, model=model)
    return result or "I wasn't able to generate a response. Please try again."