"""
transcribe.py
Whisper transcription via Groq API (free tier).
Receives audio blob, returns transcript text.
No GPU needed — runs on Groq's servers.
"""

import os
import tempfile
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

router = APIRouter()


class TranscriptResponse(BaseModel):
    transcript: str


@router.post("/transcribe", response_model=TranscriptResponse)
async def transcribe_audio(request: Request):
    """
    Accept raw audio blob (webm) from the browser.
    Send to Groq Whisper API and return transcript.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY not set in AI-ENGINE/.env"
        )

    # Read raw audio bytes from request body
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="No audio data received.")

    # Save to temp file — Groq client needs a file-like object
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        from groq import Groq

        client = Groq(api_key=api_key)

        print(f"[Groq Whisper] Transcribing {len(audio_bytes)} bytes...")

        with open(tmp_path, "rb") as audio_file:
            result = client.audio.transcriptions.create(
                file=("audio.webm", audio_file, "audio/webm"),
                model="whisper-large-v3-turbo",  # fast + accurate, free tier
                language="en",
                response_format="text",
            )

        # Groq returns plain text when response_format="text"
        transcript = result.strip() if isinstance(result, str) else result.text.strip()

        print(f"[Groq Whisper] Transcript: {transcript[:80]}")
        return TranscriptResponse(transcript=transcript)

    except Exception as e:
        print(f"[Groq Whisper ERROR] {type(e).__name__}: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass