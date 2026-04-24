import httpx
import time
import os
from datetime import datetime, timezone
from typing import Optional

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-secret")


async def send_analytics_event(event: dict):
    """Fire-and-forget — never blocks the main response."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{BACKEND_URL}/analytics/event",
                json=event,
                headers={"x-internal-token": INTERNAL_TOKEN},
            )
    except Exception:
        pass  # Analytics must never crash the main flow


def build_event(
    event_type: str,
    user_id: str = "anonymous",
    expert: str = "unknown",
    session_id: Optional[str] = None,
    response_time_ms: Optional[int] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    error_type: Optional[str] = None,
    error_message: Optional[str] = None,
    generated_image: bool = False,
    generated_file: bool = False,
    file_type: Optional[str] = None,
    prompt_length: Optional[int] = None,
    message_id: Optional[str] = None,
) -> dict:
    return {
        "eventType":      event_type,
        "userId":         user_id,
        "expert":         expert,
        "sessionId":      session_id,
        "responseTimeMs": response_time_ms,
        "tokensIn":       tokens_in,
        "tokensOut":      tokens_out,
        "errorType":      error_type,
        "errorMessage":   error_message,
        "generatedImage": generated_image,
        "generatedFile":  generated_file,
        "fileType":       file_type,
        "promptLength":   prompt_length,
        "messageId":      message_id,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }


class Timer:
    """Usage:  with Timer() as t:  ...  print(t.elapsed_ms)"""
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed_ms = int((time.perf_counter() - self._start) * 1000)