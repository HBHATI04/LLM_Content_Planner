import os
import re
from typing import Generator
from openai import OpenAI
from pathlib import Path
from dotenv import load_dotenv
from crewai import Crew, Task
from agents.writer_agent import writer_agent
from memory.memory_manager import MemoryManager
from tools.stability_image_tool import StabilityImageTool
from tools.document_generator import generate_pdf, generate_docx
from crew.multi_agent_crew import run_expert_crew, get_experts_list, run_expert_crew_stream

_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)

memory = MemoryManager()

# ── LangSmith traceable (safe import — works even if langsmith not installed) ──
try:
    from langsmith import traceable
    LANGSMITH_ENABLED = os.getenv("LANGCHAIN_TRACING_V2") == "true"
except ImportError:
    # Fallback: traceable becomes a no-op decorator
    def traceable(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator if args and callable(args[0]) else decorator
    LANGSMITH_ENABLED = False

IMAGE_KEYWORDS = [
    "image", "logo", "poster", "banner", "graphic", "illustration",
    "photo", "picture", "visual", "design a", "generate a", "create a logo",
    "make a logo", "draw", "artwork", "flyer", "thumbnail",
]

PDF_KEYWORDS  = [
    "as a pdf", "as pdf", "in pdf", "pdf format", "save as pdf",
    "export pdf", "download pdf", "give me a pdf", "make a pdf",
    "generate pdf", "output as pdf", "output in pdf", "pdf file",
    "as a pdf file", "in pdf file",
]
DOCX_KEYWORDS = [
    "as a word", "as word", "in word", "word doc", "docx", ".docx",
    "word document", "word format", "save as word", "export word",
    "give me a word", "make a word doc", "as a doc", "in doc format",
    "as doc", "as a doc file", "doc file", "as doc file",
    "generate doc", "output as doc", "output in doc", "in doc",
    "as a word file", "word file", "generate word", "output as word",
    "in word format", "as docx",
]


def _is_image_request(prompt: str) -> bool:
    lower = prompt.lower()
    return any(kw in lower for kw in IMAGE_KEYWORDS)


def _detect_export_format(prompt: str) -> str | None:
    lower = prompt.lower()
    if any(kw in lower for kw in PDF_KEYWORDS):
        return "pdf"
    if any(kw in lower for kw in DOCX_KEYWORDS):
        return "docx"
    return None


def _get_previous_ai_response(history: list) -> str | None:
    for msg in reversed(history):
        if msg.get("role") == "ai" and msg.get("content"):
            return msg["content"]
    return None


def _strip_export_request(prompt: str) -> str:
    lower = prompt.lower()
    all_export_kw = PDF_KEYWORDS + DOCX_KEYWORDS + [
        "generate output as", "output as", "save as", "export as",
        "give output as", "give it as", "give me it as",
    ]
    cut_pos = len(prompt)
    for kw in all_export_kw:
        idx = lower.find(kw)
        if idx != -1 and idx < cut_pos:
            cut_pos = idx
    stripped = prompt[:cut_pos].strip().rstrip(".,;")
    return stripped if stripped else prompt


def _generate_document(content: str, fmt: str, title: str = "Marketing Strategy") -> dict:
    if fmt == "pdf":
        file_path = generate_pdf(content, title)
        ext = ".pdf"
    else:
        file_path = generate_docx(content, title)
        ext = ".docx"

    if file_path:
        clean = file_path.lstrip("/")
        return {
            "text": f"Your {fmt.upper()} is ready! Click the download button below.",
            "fileUrl": f"/{clean}",
            "fileName": title[:40].replace(" ", "_").lower() + ext,
        }
    return {"text": f"Sorry, I could not generate the {fmt.upper()}. Please try again."}


def _call_stability(image_prompt: str) -> str | None:
    try:
        tool = StabilityImageTool()
        return tool._run(image_prompt)
    except Exception as e:
        print(f"[Stability ERROR] {e}")
        return None


def _get_openai_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("NVIDIA_API_KEY"),
        base_url="https://integrate.api.nvidia.com/v1",
    )


def _is_greeting(prompt: str) -> bool:
    return len(prompt.strip().split()) <= 3 and not any(
        c in prompt.lower() for c in ["how", "what", "why", "when", "?"]
    )


def _build_messages(prompt: str, formatted_history: str, is_greeting: bool) -> list:
    if is_greeting:
        return [
            {"role": "system", "content": "You are a helpful marketing AI assistant. Reply to greetings warmly in 1-2 sentences."},
            {"role": "user", "content": prompt},
        ]
    history_text = (
        f"\n\nConversation so far:\n{formatted_history}"
        if formatted_history and formatted_history != "No prior conversation." else ""
    )
    return [
        {"role": "system", "content": (
            "You are an expert marketing AI assistant specializing in brand strategy, "
            "digital marketing, campaigns, and growth tactics. "
            "Give detailed, structured, actionable advice. "
            "Never start with 'Here is' or similar preambles. "
            "Never ask the user to rephrase. Always answer directly."
        )},
        {"role": "user", "content": f"{history_text}\n\nUser: {prompt}\n\nAssistant:"},
    ]


# ── Traced direct LLM call ─────────────────────────────────────────────────────
@traceable(name="direct-llm-call", run_type="llm")
def _traced_llm_call(
    messages: list,
    model: str = "meta/llama-3.1-8b-instruct",
    max_tokens: int = 1000,
    temperature: float = 0.7,
    expert: str = "unknown",
    call_type: str = "chat",
) -> tuple[str, int, int]:
    """
    Wraps direct OpenAI/NVIDIA calls so they appear in LangSmith.
    Returns (response_text, tokens_in, tokens_out).
    """
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    text = response.choices[0].message.content.strip()
    if text.lower().startswith("assistant:"):
        text = text[len("assistant:"):].strip()

    # Extract real token counts from response
    tokens_in  = getattr(response.usage, "prompt_tokens",     0) if response.usage else 0
    tokens_out = getattr(response.usage, "completion_tokens", 0) if response.usage else 0

    return text, tokens_in, tokens_out


# ── Non-streaming ──────────────────────────────────────────────────────────────
@traceable(name="run-chat", run_type="chain")
def run_chat(prompt: str, history: list, expert: str = "strategist") -> dict:
    try:
        formatted_history = memory.format_history(history)

        # ── Export request? ───────────────────────────────────────────────────
        export_fmt = _detect_export_format(prompt)
        if export_fmt:
            prev = _get_previous_ai_response(history)
            if not prev:
                content_prompt = _strip_export_request(prompt)
                print(f"[Export] No prior response. Generating content for: {content_prompt}")
                messages = _build_messages(content_prompt, formatted_history, False)
                prev, _, _ = _traced_llm_call(
                    messages=messages,
                    max_tokens=1500,
                    temperature=0.7,
                    expert=expert,
                    call_type="export-content",
                )

            title_prompt = _strip_export_request(prompt)
            title = title_prompt[:50].strip() if title_prompt != prompt else "AI Generated Report"
            return _generate_document(prev, export_fmt, title)

        # ── Image request? ────────────────────────────────────────────────────
        if _is_image_request(prompt):
            messages = [
                {"role": "system", "content": "You are an expert at writing Stable Diffusion image generation prompts. Output ONLY the image prompt — no preamble, no labels, no explanation."},
                {"role": "user", "content": f"Write a detailed Stable Diffusion prompt for: {prompt}\nDescribe subject, style, colors, mood, lighting, composition."},
            ]
            image_prompt, _, _ = _traced_llm_call(
                messages=messages,
                max_tokens=200,
                temperature=0.7,
                expert=expert,
                call_type="image-prompt",
            )
            for prefix in ["here is", "image prompt:", "prompt:", "output:"]:
                if image_prompt.lower().startswith(prefix):
                    image_prompt = image_prompt[len(prefix):].strip(" :\n")

            print(f"[Image Prompt] {image_prompt}")
            file_path = _call_stability(image_prompt)
            if file_path and file_path.endswith(".png"):
                return {"text": "Here is your generated image:", "imageUrl": f"/{file_path.lstrip('/')}"}
            return {"text": "Image generation failed. Check your STABILITY_API_KEY in .env."}
            
        # ── Text response ─────────────────────────────────────────────────────
        messages = _build_messages(prompt, formatted_history, _is_greeting(prompt))
        text, _, _ = _traced_llm_call(
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
            expert=expert,
            call_type="chat",
        )
        return {"text": text}

    except Exception as e:
        import traceback
        print(f"[run_chat ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return {"text": f"[DEBUG] {type(e).__name__}: {str(e)}"}


# ── Streaming ──────────────────────────────────────────────────────────────────
@traceable(name="stream-chat", run_type="chain")
def stream_chat(prompt: str, history: list, expert: str = "strategist", **kwargs) -> Generator[dict, None, None]:
    try:
        formatted_history = memory.format_history(history)

        # ── Export request? ───────────────────────────────────────────────────
        export_fmt = _detect_export_format(prompt)
        if export_fmt:
            prev = _get_previous_ai_response(history)
            if not prev:
                content_prompt = _strip_export_request(prompt)
                print(f"[Export Stream] Generating content for: {content_prompt}")
                yield {"type": "token", "value": f"Generating content and creating your {export_fmt.upper()}, please wait..."}

                messages = _build_messages(content_prompt, formatted_history, False)
                prev, _, _ = _traced_llm_call(
                    messages=messages,
                    max_tokens=1500,
                    temperature=0.7,
                    expert=expert,
                    call_type="export-content-stream",
                )
            else:
                yield {"type": "token", "value": f"Generating your {export_fmt.upper()}, please wait..."}

            title_prompt = _strip_export_request(prompt)
            title = title_prompt[:50].strip() if title_prompt != prompt else "AI Generated Report"
            result = _generate_document(prev, export_fmt, title)

            if result.get("fileUrl"):
                yield {"type": "file", "fileUrl": result["fileUrl"], "fileName": result["fileName"]}
                yield {"type": "token", "value": f"\n\nYour {export_fmt.upper()} is ready! Click the card below to download."}
            else:
                yield {"type": "token", "value": result["text"]}

            yield {"type": "done", "value": ""}
            return

        # ── Image request? ────────────────────────────────────────────────────
        if _is_image_request(prompt):
            yield {"type": "token", "value": "Generating your image, please wait..."}
            messages = [
                {"role": "system", "content": "You are an expert at writing Stable Diffusion image generation prompts. Output ONLY the image prompt — no preamble, no labels, no explanation."},
                {"role": "user", "content": f"Write a detailed Stable Diffusion prompt for: {prompt}\nDescribe subject, style, colors, mood, lighting, composition."},
            ]
            image_prompt, _, _ = _traced_llm_call(
                messages=messages,
                max_tokens=200,
                temperature=0.7,
                expert=expert,
                call_type="image-prompt-stream",
            )
            for prefix in ["here is", "image prompt:", "prompt:", "output:"]:
                if image_prompt.lower().startswith(prefix):
                    image_prompt = image_prompt[len(prefix):].strip(" :\n")

            print(f"[Image Prompt] {image_prompt}")
            file_path = _call_stability(image_prompt)
            if file_path and file_path.endswith(".png"):
                yield {"type": "image", "value": f"/{file_path.lstrip('/')}"}
            else:
                yield {"type": "token", "value": "\n\nImage generation failed. Check STABILITY_API_KEY."}
            yield {"type": "done", "value": ""}
            return
        # ── Greeting — fast direct streaming ────────────────────────────────────
        if _is_greeting(prompt):
            client = _get_openai_client()
            stream = client.chat.completions.create(
                model="meta/llama-3.1-70b-instruct",
                messages=[
                    {"role": "system", "content": "You are a helpful marketing AI. Reply to greetings warmly in 1-2 sentences."},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=100,
                temperature=0.7,
                stream=True,
            )
            for chunk in stream:
                token = getattr(chunk.choices[0].delta, "content", None)
                if token:
                    yield {"type": "token", "value": token}
            yield {"type": "done", "value": ""}
            return

        # ── Multi-agent expert crew (true token-by-token streaming) ─────────────
        for event in run_expert_crew_stream(prompt, history, expert):
            yield event

        yield {"type": "done", "value": ""}

    except Exception as e:
        import traceback
        print(f"[stream_chat ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        yield {"type": "error", "value": str(e)}
