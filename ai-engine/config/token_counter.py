def estimate_tokens(text: str) -> int:
    """~4 chars per token heuristic — good enough when API doesn't return usage."""
    if not text:
        return 0
    return max(1, len(text) // 4)


def tokens_from_crew_result(result_raw: str, prompt: str) -> tuple[int, int]:
    """Returns (tokens_in, tokens_out) estimated from text lengths."""
    return estimate_tokens(prompt), estimate_tokens(result_raw)


def tokens_from_openai_response(response_data: dict) -> tuple[int, int]:
    """Extracts real token counts from an OpenAI-compatible API response."""
    try:
        usage = response_data.get("usage", {})
        return usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
    except Exception:
        return 0, 0