"""
multi_agent_crew.py
Routes user messages to the correct expert's 3-agent internal crew.
Each expert has: analyst → specialist → reviewer
"""

import os
from typing import Generator
from openai import OpenAI
from pathlib import Path
from dotenv import load_dotenv
from crewai import Crew, Task
from memory.memory_manager import MemoryManager

memory = MemoryManager()

# ── Expert registry ────────────────────────────────────────────────────────────
EXPERTS = {
    "strategist": {
        "label": "Content Strategist",
        "emoji": "🎯",
        "description": "Brand & campaign planning",
        "module": "agents.content_strategist",
    },
    "copywriter": {
        "label": "Copywriter",
        "emoji": "✍️",
        "description": "Posts, ads & captions",
        "module": "agents.copy_writer",
    },
    "seo": {
        "label": "SEO Expert",
        "emoji": "🔍",
        "description": "Keywords, rankings & traffic",
        "module": "agents.seo_expert",
    },
    "social": {
        "label": "Social Media Manager",
        "emoji": "📱",
        "description": "Platform-specific content",
        "module": "agents.social_media_manager",
    },
    "analyst": {
        "label": "Campaign Analyst",
        "emoji": "📊",
        "description": "Metrics, ROI & performance",
        "module": "agents.campaign_analyst",
    },
}

DEFAULT_EXPERT = "strategist"


def _load_expert_agents(expert_key: str):
    """Dynamically import the 3 agents for the given expert."""
    import importlib
    import sys
    from pathlib import Path

    # __file__ is: AI-ENGINE/crew/multi_agent_crew.py
    # parent       = AI-ENGINE/crew/
    # parent.parent = AI-ENGINE/   ← this is what we need on sys.path
    ai_engine_root = str(Path(__file__).resolve().parent.parent)
    print(f"[MultiAgent] sys.path root: {ai_engine_root}")

    if ai_engine_root not in sys.path:
        sys.path.insert(0, ai_engine_root)

    print(f"[MultiAgent] sys.path: {sys.path[:4]}")

    meta = EXPERTS.get(expert_key) or EXPERTS[DEFAULT_EXPERT]

    # Import directly by file path as fallback if package import fails
    try:
        module = importlib.import_module(meta["module"])
    except ModuleNotFoundError:
        # Fallback: load by absolute file path
        import importlib.util
        module_name = meta["module"].split(".")[-1]  # e.g. "copy_writer"
        file_path = Path(ai_engine_root) / "agents" / f"{module_name}.py"
        print(f"[MultiAgent] Fallback import from: {file_path}")
        spec = importlib.util.spec_from_file_location(module_name, file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

    return module.analyst, module.specialist, module.reviewer, meta


def run_expert_crew(prompt: str, history: list, expert_key: str = DEFAULT_EXPERT) -> dict:
    """
    Run the 3-agent crew for the selected expert.
    Returns {"text": "...", "expert": "...", "expert_label": "..."}
    """
    try:
        formatted_history = memory.format_history(history)
        analyst, specialist, reviewer, meta = _load_expert_agents(expert_key)

        expert_label = meta["label"]
        print(f"[MultiAgent] Running {expert_label} crew for: {prompt[:60]}")

        # ── Task 1: Analyst ────────────────────────────────────────────────────
        analyse_task = Task(
           description=f"Briefly analyse this request for a {expert_label}. User: {prompt}",
           expected_output="3-5 bullet points: core need, audience, constraints, key focus areas. Be concise.",
           agent=analyst,
        )

        # ── Task 2: Specialist ─────────────────────────────────────────────────
        specialist_task = Task(
           description=f"Using the analyst's brief, draft a {expert_label} response. Be specific and direct. No preamble.",
            expected_output=f"A focused {expert_label} draft. Specific, actionable, no fluff. Max 400 words.",
            agent=specialist,
            context=[analyse_task],
        )

        # ── Task 3: Reviewer ───────────────────────────────────────────────────
        review_task = Task(
            description=f"""
            You are the {expert_label} team's reviewer.
            Your job is to produce the FINAL response the user will see.

            STRICT RULES — violating any of these is a failure:

            1. REMOVE completely:
               - Any "Executive Summary" section
               - Any "Recommendations for Further Research" section
               - Any sentence containing "we assume", "we would like to clarify",
                 "we recommend conducting further research", or "to refine this"
               - Any "Brand Voice" or "Visual Identity" section unless the user asked for it
               - Any "Goals and KPIs" section unless the user specifically asked for KPIs
               - Any "Existing Brand Assets" section
               - All meta-commentary about the response itself

            2. START directly with the answer — no preamble, no summary header.
               First line must be useful content, not an introduction.

            3. KEEP only:
               - The core deliverable the user asked for
               - Supporting context that directly helps the user act
               - Specific, concrete recommendations with numbers where relevant

            4. FORMAT cleanly:
               - Use clear section headers for long responses
               - Use bullet points for lists
               - Bold key terms
               - No corporate consulting language

            5. LENGTH: Match the complexity of the request.
               Simple request (5 captions) → short focused output.
               Complex request (full strategy) → detailed but clean output.

            The response must read like a direct answer from a single expert,
            not a consulting firm's proposal document.
            """,
            expected_output=(
                "A clean, direct expert response containing ONLY what the user "
                "asked for. No executive summaries, no research recommendations, "
                "no hedging language. Just the answer."
            ),
            agent=reviewer,
            context=[analyse_task, specialist_task],
        )

        crew = Crew(
            agents=[analyst, specialist, reviewer],
            tasks=[analyse_task, specialist_task, review_task],
            verbose=False,
            prompt_file=None,
        )

        # Tag the run in LangSmith with expert and prompt metadata
        try:
            from langsmith import traceable
            import langsmith as ls
            client = ls.Client()
            # Metadata will appear in LangSmith trace as run tags
            run_metadata = {
                "expert": expert_key,
                "expert_label": expert_label,
                "prompt_preview": prompt[:100],
            }
        except Exception:
            run_metadata = {}

        result = crew.kickoff()
        raw = str(result.raw if hasattr(result, "raw") else result).strip()

        # Strip any "Assistant:" echo
        if raw.lower().startswith("assistant:"):
            raw = raw[len("assistant:"):].strip()

        return {
            "text": raw,
            "expert": expert_key,
            "expertLabel": expert_label,
            "expertEmoji": meta["emoji"],
        }

    except RuntimeError as e:
        if "cannot schedule new futures after shutdown" in str(e):
            # Server was shutting down mid-request — safe to ignore
            print(f"[MultiAgent] Server shutdown interrupted request — ignoring.")
            return {
                "text": "Request was interrupted by server restart. Please try again.",
                "expert": expert_key,
                "expertLabel": EXPERTS.get(expert_key, {}).get("label", "Expert"),
            }
        import traceback
        print(f"[MultiAgent ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return {
            "text": "Sorry, I encountered an issue. Please try again.",
            "expert": expert_key,
            "expertLabel": EXPERTS.get(expert_key, {}).get("label", "Expert"),
        }

    except Exception as e:
        import traceback
        print(f"[MultiAgent ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        return {
            "text": "Sorry, I encountered an issue. Please try again.",
            "expert": expert_key,
            "expertLabel": EXPERTS.get(expert_key, {}).get("label", "Expert"),
        }


def run_expert_crew_stream(
    prompt: str, history: list, expert_key: str = DEFAULT_EXPERT
) -> Generator[dict, None, None]:
    """
    True-streaming variant of run_expert_crew.
    - Analyst + Specialist run synchronously (fast prep crew, no output to user yet).
    - Reviewer answer is streamed token-by-token via the NVIDIA streaming API.
    Yields dicts: {"type": "status"|"status_clear"|"token"|"expert_meta"|"error"}
    """
    # Ensure env is loaded even when called from a fresh import context
    load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env", override=True)

    try:
        formatted_history = memory.format_history(history)
        analyst, specialist, reviewer, meta = _load_expert_agents(expert_key)
        expert_label = meta["label"]
        print(f"[MultiAgentStream] Running {expert_label} for: {prompt[:60]}")

        # ── Phase 1: analyst + specialist (blocking, no tokens shown yet) ─────
        yield {"type": "status", "value": f"Analyzing your request…"}

        analyse_task = Task(
            description=f"Briefly analyse this request for a {expert_label}. User: {prompt}. History: {formatted_history}",
            expected_output="3-5 bullet points: core need, audience, constraints, key focus areas. Be concise.",
            agent=analyst,
        )

        specialist_task = Task(
            description=f"Using the analyst's brief, draft a {expert_label} response. Be specific and direct. No preamble.",
            expected_output=f"A focused {expert_label} draft. Specific, actionable, no fluff. Max 400 words.",
            agent=specialist,
            context=[analyse_task],
        )

        prep_crew = Crew(
            agents=[analyst, specialist],
            tasks=[analyse_task, specialist_task],
            verbose=False,
        )
        prep_result = prep_crew.kickoff()
        specialist_output = str(
            prep_result.raw if hasattr(prep_result, "raw") else prep_result
        ).strip()

        print(f"[MultiAgentStream] Prep crew done — starting reviewer stream")

        # ── Phase 2: reviewer streams token-by-token ──────────────────────────
        yield {"type": "status_clear"}

        # Reviewer system + user prompt — mirrors the blocking Task description
        review_system = (
            f"You are the {expert_label} team's final reviewer and editor. "
            "Your job is to produce the FINAL response the user will see. "
            "You write clean, direct, expert content — no consulting fluff."
        )
        review_user = f"""Below is a draft prepared by the {expert_label} team for this request:

USER REQUEST:
{prompt}

DRAFT RESPONSE:
{specialist_output}

Rewrite / refine this into the final user-facing response.

STRICT RULES (violating any = failure):
1. REMOVE completely:
   - Any "Executive Summary" section
   - Any "Recommendations for Further Research" section
   - Sentences containing "we assume", "we would like to clarify", or "further research"
   - "Brand Voice", "Visual Identity", "Goals and KPIs", or "Existing Brand Assets"
     sections UNLESS the user explicitly asked for them
   - All meta-commentary about the response itself

2. START directly with the answer — first line must be useful content, not an introduction.

3. FORMAT cleanly:
   - Use ## section headers for structured responses
   - Use bullet points for lists
   - Bold key terms with **bold**
   - No corporate consulting language

4. LENGTH: Match the complexity of the request.
   Simple request → short focused output. Complex request → detailed but clean.

Output ONLY the final response. No preamble, no commentary."""

        client = OpenAI(
            api_key=os.getenv("NVIDIA_API_KEY"),
            base_url="https://integrate.api.nvidia.com/v1",
        )
        stream = client.chat.completions.create(
            model="meta/llama-3.1-70b-instruct",
            messages=[
                {"role": "system", "content": review_system},
                {"role": "user",   "content": review_user},
            ],
            max_tokens=900,
            temperature=0.6,
            stream=True,
        )

        for chunk in stream:
            token = getattr(chunk.choices[0].delta, "content", None)
            if token:
                yield {"type": "token", "value": token}

        yield {
            "type": "expert_meta",
            "expert": expert_key,
            "expertLabel": expert_label,
            "expertEmoji": meta["emoji"],
        }

    except RuntimeError as e:
        if "cannot schedule new futures after shutdown" in str(e):
            print("[MultiAgentStream] Server shutdown interrupted request — ignoring.")
            yield {"type": "error", "value": "Request interrupted by server restart. Please try again."}
            return
        import traceback
        print(f"[MultiAgentStream ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        yield {"type": "error", "value": str(e)}

    except Exception as e:
        import traceback
        print(f"[MultiAgentStream ERROR] {type(e).__name__}: {e}")
        print(traceback.format_exc())
        yield {"type": "error", "value": str(e)}


def get_experts_list() -> list:
    """Return expert metadata for the frontend selector."""
    return [
        {
            "key": key,
            "label": meta["label"],
            "emoji": meta["emoji"],
            "description": meta["description"],
        }
        for key, meta in EXPERTS.items()
    ]