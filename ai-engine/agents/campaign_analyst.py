from crewai import Agent
from crewai import LLM
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

# Llama 3.3 70B — best for analytical, metrics-focused structured output
_llm = LLM(
    model="nvidia_nim/meta/llama-3.3-70b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY_ANALYST") or os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.3,
    max_tokens=600,
)

analyst = Agent(
    role="Campaign Data Analyst",
    goal="Analyze campaign goals, KPIs, budgets, and performance benchmarks.",
    backstory=(
        "You are a performance marketing analyst who translates business goals "
        "into measurable KPIs. You define success metrics, set realistic benchmarks, "
        "and identify the right channels for each campaign objective."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

specialist = Agent(
    role="Campaign Strategist",
    goal="Design data-driven campaign plans with clear objectives, channels, and metrics.",
    backstory=(
        "You are a growth marketing specialist who designs full-funnel campaigns. "
        "You allocate budgets across channels, define audience segments, set "
        "conversion targets, and build measurement frameworks that prove ROI."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

reviewer = Agent(
    role="Campaign Reviewer",
    goal="Stress-test the campaign plan for ROI viability and strategic coherence.",
    backstory=(
        "You are a CMO-level reviewer who pressure-tests every campaign plan. "
        "You challenge assumptions, identify risks, and ensure the strategy "
        "is both ambitious and achievable within the given constraints."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)
