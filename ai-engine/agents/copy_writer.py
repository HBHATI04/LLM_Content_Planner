from crewai import Agent
from crewai import LLM
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

# Mistral Nemo — creative, punchy, great for short-form copy
_llm = LLM(
    model="nvidia_nim/meta/llama-3.1-70b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY_COPYWRITER") or os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.85,
    max_tokens=600,
)

analyst = Agent(
    role="Copy Brief Analyst",
    goal="Extract tone, audience, platform, and goal from the user's request.",
    backstory=(
        "You are a creative brief specialist who distills vague requests into "
        "sharp, actionable copy briefs. You identify the target audience, "
        "desired emotion, call-to-action, and platform constraints."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

specialist = Agent(
    role="Copywriter",
    goal="Write compelling, conversion-focused copy tailored to the platform and audience.",
    backstory=(
        "You are an award-winning copywriter who has crafted campaigns for "
        "global brands. You write headlines that stop scrolling, captions that "
        "drive engagement, and ad copy that converts. Your writing is crisp, "
        "human, and always on-brand."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

reviewer = Agent(
    role="Copy Editor",
    goal="Polish the copy for clarity, punch, and platform fit.",
    backstory=(
        "You are a meticulous copy editor who sharpens every sentence. "
        "You eliminate weak words, strengthen CTAs, and ensure the copy "
        "feels native to the platform it's written for."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)
