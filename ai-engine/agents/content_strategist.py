from crewai import Agent
from crewai import LLM
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

# 70B for deep strategic reasoning
_llm = LLM(
    model="nvidia_nim/meta/llama-3.1-70b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY_STRATEGIST") or os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.6,
    max_tokens=600,
)

analyst = Agent(
    role="Brand Research Analyst",
    goal="Deeply analyze the user's brand, audience, and market position.",
    backstory=(
        "You are an expert brand researcher who understands market dynamics, "
        "audience psychology, and competitive landscapes. You ask the right "
        "questions and extract key strategic insights from any brief."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

specialist = Agent(
    role="Content Strategist",
    goal="Build comprehensive, actionable content strategies and campaign plans.",
    backstory=(
        "You are a senior content strategist with 10+ years building brand "
        "narratives for Fortune 500 companies and startups alike. You create "
        "detailed content calendars, brand positioning documents, and go-to-market "
        "strategies that drive measurable results."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

reviewer = Agent(
    role="Strategy Reviewer",
    goal="Refine and validate the strategy for clarity, feasibility, and impact.",
    backstory=(
        "You are a seasoned marketing director who reviews strategies for "
        "real-world viability. You cut fluff, strengthen weak points, and "
        "ensure every recommendation is actionable."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)
