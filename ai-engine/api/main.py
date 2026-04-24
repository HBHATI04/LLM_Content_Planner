import json
import time
import threading
import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from crew.chat_crew import run_chat, stream_chat
from transcribe import router as transcribe_router
from crew.multi_agent_crew import get_experts_list
from config.langsmith import setup_langsmith
from tools.document_generator import generate_pdf, generate_docx

# Initialize LangSmith tracing before anything else
setup_langsmith()

app = FastAPI(title="AI-Engine", version="1.0.0")

# Serve generated docs statically so Express can proxy them
os.makedirs("generated_docs", exist_ok=True)
app.mount("/generated_docs", StaticFiles(directory="generated_docs"), name="generated_docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("BACKEND_URL", "http://localhost:5000"),
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Analytics config ──────────────────────────────────────────────────────────
BACKEND_URL    = os.getenv("BACKEND_URL", "http://localhost:5000")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-secret")

def estimate_tokens(text: str) -> int:
    """~4 chars per token heuristic."""
    if not text:
        return 0
    return max(1, len(text) // 4)

def fire(payload: dict):
    """
    Send analytics in a background thread — never blocks the response.
    Works correctly in both sync and async FastAPI routes.
    """
    def _send():
        try:
            import httpx
            with httpx.Client(timeout=5) as client:
                r = client.post(
                    f"{BACKEND_URL}/analytics/event",
                    json=payload,
                    headers={"x-internal-token": INTERNAL_TOKEN},
                )
                print(f"[Analytics] {payload.get('eventType')} | expert={payload.get('expert')} | user={payload.get('userId')} | {payload.get('responseTimeMs')}ms | status={r.status_code}")
        except Exception as e:
            print(f"[Analytics] Failed to send event: {e}")

    threading.Thread(target=_send, daemon=True).start()

def make_event(
    event_type: str,
    expert: str,
    user_id: str = "anonymous",
    response_time_ms: int = None,
    tokens_in: int = 0,
    tokens_out: int = 0,
    error_type: str = None,
    error_message: str = None,
    generated_image: bool = False,
    generated_file: bool = False,
    file_type: str = None,
    prompt_length: int = 0,
) -> dict:
    return {
        "eventType":      event_type,
        "userId":         user_id,
        "expert":         expert,
        "responseTimeMs": response_time_ms,
        "tokensIn":       tokens_in,
        "tokensOut":      tokens_out,
        "errorType":      error_type,
        "errorMessage":   error_message,
        "generatedImage": generated_image,
        "generatedFile":  generated_file,
        "fileType":       file_type,
        "promptLength":   prompt_length,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }

# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    prompt: str
    history: list = []
    expert: str = "strategist"
    userId: str = "anonymous"   # ← frontend should pass this


class ExportRequest(BaseModel):
    content: str
    format: str
    title: str = "AI Generated Report"
    userId: str = "anonymous"   # ← frontend should pass this


class ChatResponse(BaseModel):
    text: str
    imageUrl: str | None = None
    fileUrl: str | None = None
    fileName: str | None = None
    expert: str | None = None
    expertLabel: str | None = None
    expertEmoji: str | None = None
    status: str = "success"


# Transcription routes
app.include_router(transcribe_router)


@app.get("/experts")
def list_experts():
    return {"experts": get_experts_list()}


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ── Export endpoint ───────────────────────────────────────────────────────────
@app.post("/export")
def export_document(data: ExportRequest):
    fmt   = data.format.lower().strip()
    start = time.perf_counter()

    try:
        if fmt == "pdf":
            file_path  = generate_pdf(data.content, data.title)
            media_type = "application/pdf"
            suffix     = ".pdf"
        elif fmt in ("docx", "doc", "word"):
            file_path  = generate_docx(data.content, data.title)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            suffix     = ".docx"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}.")

        if not file_path:
            raise HTTPException(status_code=500, detail="Document generation failed.")

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        fire(make_event(
            event_type="file",
            expert=getattr(data, "expert", "unknown"),
            user_id=data.userId,
            response_time_ms=elapsed_ms,
            generated_file=True,
            file_type=fmt,
            prompt_length=len(data.content),
        ))

        filename = data.title[:40].replace(" ", "_").lower() + suffix
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        fire(make_event(
            event_type="error",
            expert="unknown",
            user_id=data.userId,
            response_time_ms=elapsed_ms,
            error_type=type(e).__name__,
            error_message=str(e)[:500],
            file_type=fmt,
        ))
        raise HTTPException(status_code=500, detail=str(e))


# ── Non-streaming chat ────────────────────────────────────────────────────────
@app.post("/chat", response_model=ChatResponse)
def chat(data: ChatRequest):
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    start = time.perf_counter()

    try:
        result = run_chat(data.prompt, data.history, data.expert)

        elapsed_ms = int((time.perf_counter() - start) * 1000)
        response_text = result.get("text", "")
        tokens_in     = estimate_tokens(data.prompt)
        tokens_out    = estimate_tokens(response_text)

        fire(make_event(
            event_type="message",
            expert=data.expert,
            user_id=data.userId,
            response_time_ms=elapsed_ms,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            generated_image=bool(result.get("imageUrl")),
            generated_file=bool(result.get("fileUrl")),
            prompt_length=len(data.prompt),
        ))

        # If the response includes an image, also log an image event
        if result.get("imageUrl"):
            fire(make_event(
                event_type="image",
                expert=data.expert,
                user_id=data.userId,
                generated_image=True,
                prompt_length=len(data.prompt),
            ))

        return ChatResponse(
            text=result.get("text", ""),
            imageUrl=result.get("imageUrl"),
            fileUrl=result.get("fileUrl"),
            fileName=result.get("fileName"),
            expert=result.get("expert"),
            expertLabel=result.get("expertLabel"),
            expertEmoji=result.get("expertEmoji"),
        )

    except HTTPException:
        raise
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start) * 1000)
        fire(make_event(
            event_type="error",
            expert=data.expert,
            user_id=data.userId,
            response_time_ms=elapsed_ms,
            error_type=type(e).__name__,
            error_message=str(e)[:500],
            prompt_length=len(data.prompt),
        ))
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming chat ────────────────────────────────────────────────────────────
@app.post("/chat/stream")
def chat_stream(data: ChatRequest):
    """
    SSE streaming endpoint.
    Events: token | done | error | image | file
    Analytics fired after stream completes.
    """
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    def event_generator():
        start          = time.perf_counter()
        full_text      = []
        has_image      = False
        has_file       = False
        error_occurred = None

        try:
            for event in stream_chat(data.prompt, data.history, data.expert):
                # Track what came through the stream
                if event.get("type") == "token":
                    full_text.append(event.get("value", ""))
                elif event.get("type") == "image":
                    has_image = True
                elif event.get("type") == "file":
                    has_file = True

                yield json.dumps(event) + "\n"

        except Exception as e:
            error_occurred = e
            yield json.dumps({"type": "error", "value": str(e)}) + "\n"

        finally:
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            response_text = "".join(full_text)

            if error_occurred:
                fire(make_event(
                    event_type="error",
                    expert=data.expert,
                    user_id=data.userId,
                    response_time_ms=elapsed_ms,
                    error_type=type(error_occurred).__name__,
                    error_message=str(error_occurred)[:500],
                    prompt_length=len(data.prompt),
                ))
            else:
                fire(make_event(
                    event_type="message",
                    expert=data.expert,
                    user_id=data.userId,
                    response_time_ms=elapsed_ms,
                    tokens_in=estimate_tokens(data.prompt),
                    tokens_out=estimate_tokens(response_text),
                    generated_image=has_image,
                    generated_file=has_file,
                    prompt_length=len(data.prompt),
                ))

                if has_image:
                    fire(make_event(
                        event_type="image",
                        expert=data.expert,
                        user_id=data.userId,
                        generated_image=True,
                        prompt_length=len(data.prompt),
                    ))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )