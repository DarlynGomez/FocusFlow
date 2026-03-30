import os
from dotenv import load_dotenv

load_dotenv()

anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
chat_model: str = os.getenv("CHAT_MODEL", "claude-haiku-4-5-20251001")

def get_llama_api_key() -> str | None:
    """
    Returns the LlamaParse API key from the environment.
    Returns None if the key is not set -- callers handle the None case
    rather than crashing here, so the error message can be more specific.
    """
    return os.getenv("LLAMA_CLOUD_API_KEY")


def llama_api_key_is_configured() -> bool:
    """
    Quick boolean check used by the classifier to decide
    whether LlamaParse is actually available to use.
    If the key is missing, the router falls back to pdfplumber
    and attaches a warning rather than crashing.
    """
    key = get_llama_api_key()
    return key is not None and len(key.strip()) > 0