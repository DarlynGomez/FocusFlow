"""OpenAI-compatible LLM client. Pluggable for other providers."""
from openai import OpenAI
from app.config import get_settings
import json

_settings = get_settings()
_client: OpenAI | None = None


def _client_or_default() -> OpenAI:
    global _client
    if _client is None:
        kwargs = {"api_key": _settings.openai_api_key}
        if _settings.openai_base_url:
            kwargs["base_url"] = _settings.openai_base_url
        _client = OpenAI(**kwargs)
    return _client


def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
) -> str:
    client = _client_or_default()
    model = model or _settings.chat_model
    kwargs = {"model": model, "messages": messages}
    if response_format:
        kwargs["response_format"] = response_format
    r = client.chat.completions.create(**kwargs)
    return r.choices[0].message.content or ""


def embed(texts: list[str], model: str | None = None) -> list[list[float]]:
    client = _client_or_default()
    model = model or _settings.embedding_model
    r = client.embeddings.create(input=texts, model=model)
    return [d.embedding for d in r.data]
