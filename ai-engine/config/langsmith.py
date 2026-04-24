"""
config/langsmith.py
Configures LangSmith tracing for both CrewAI and direct OpenAI calls.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)


def setup_langsmith():
    """
    Enable LangSmith tracing if LANGSMITH_API_KEY is set.
    Call this once at FastAPI startup.
    """
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("[LangSmith] LANGSMITH_API_KEY not set — tracing disabled.")
        return False

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"]    = api_key
    os.environ["LANGCHAIN_PROJECT"]    = os.getenv("LANGSMITH_PROJECT", "ai-content-planner")
    os.environ["LANGCHAIN_ENDPOINT"]   = "https://api.smith.langchain.com"

    print(f"[LangSmith] ✓ Tracing enabled → project: {os.environ['LANGCHAIN_PROJECT']}")
    print(f"[LangSmith] View traces at: https://smith.langchain.com")
    return True


def get_tracer():
    """
    Returns a LangSmith tracer client if enabled, else None.
    Use this to manually trace direct OpenAI calls.
    """
    if os.getenv("LANGCHAIN_TRACING_V2") != "true":
        return None
    try:
        from langsmith import Client
        return Client()
    except ImportError:
        print("[LangSmith] langsmith package not installed. Run: pip install langsmith")
        return None


def trace_llm_call(name: str, prompt: str, response: str, expert: str = "unknown",
                   tokens_in: int = 0, tokens_out: int = 0, model: str = "llama-3.1-8b-instruct"):
    """
    Manually log a direct OpenAI call to LangSmith.
    Call this after every _get_openai_client() completion.
    """
    if os.getenv("LANGCHAIN_TRACING_V2") != "true":
        return
    try:
        from langsmith import traceable
        # We use the run_tree approach for manual logging
        from langsmith.run_helpers import get_current_run_tree
        import langsmith as ls

        client = ls.Client()
        client.create_run(
            name=name,
            run_type="llm",
            inputs={"prompt": prompt, "expert": expert},
            outputs={"response": response},
            extra={
                "metadata": {
                    "model": model,
                    "expert": expert,
                    "tokens_in": tokens_in,
                    "tokens_out": tokens_out,
                }
            },
        )
    except Exception as e:
        pass  # Never let tracing crash the main flow