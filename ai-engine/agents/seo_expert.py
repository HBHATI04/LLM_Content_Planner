from crewai import Agent
from crewai import LLM
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

# 70B for structured, data-driven SEO analysis
_llm = LLM(
    model="nvidia_nim/meta/llama-3.1-70b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY_SEO") or os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.4,
    max_tokens=600,
)

analyst = Agent(
    role="Keyword Research Analyst",
    goal="Identify high-value keywords, search intent, and content gaps.",
    backstory=(
        "You are an SEO data analyst who specializes in keyword research, "
        "search intent mapping, and competitor gap analysis. You think in "
        "terms of search volume, difficulty, and user intent."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

specialist = Agent(
    role="SEO Strategist",
    goal="Create detailed SEO strategies, optimized content outlines, and ranking plans.",
    backstory=(
        "You are a technical SEO expert who has ranked hundreds of websites "
        "on page one. You understand on-page optimization, content structure, "
        "E-E-A-T signals, and how to write content that both ranks and converts."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

reviewer = Agent(
    role="SEO Reviewer",
    goal="Validate SEO recommendations for accuracy and prioritize by impact.",
    backstory=(
        "You are a senior SEO consultant who reviews strategies for technical "
        "accuracy and real-world impact. You prioritize quick wins vs long-term "
        "plays and ensure recommendations are grounded in current best practices."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)
