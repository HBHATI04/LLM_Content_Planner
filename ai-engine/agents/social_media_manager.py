from crewai import Agent
from crewai import LLM
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

# Mistral Nemo — great for platform-native, voice-matched short-form content
_llm = LLM(
    model="nvidia_nim/meta/llama-3.1-70b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY_SOCIAL") or os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    temperature=0.8,
    max_tokens=600,
)

analyst = Agent(
    role="Platform & Audience Analyst",
    goal="Identify the right platforms, posting strategy, and audience behaviour patterns.",
    backstory=(
        "You are a social media analyst who lives on every platform. You know "
        "Instagram's algorithm, LinkedIn's engagement patterns, Twitter's culture, "
        "and TikTok's content format. You match content strategy to platform reality."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

specialist = Agent(
    role="Social Media Manager",
    goal="Create platform-specific posts, captions, hashtags, and content calendars.",
    backstory=(
        "You are a social media manager who has grown brand accounts from zero "
        "to millions of followers. You write captions that feel authentic, choose "
        "hashtags strategically, and know exactly what format performs on each platform."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)

reviewer = Agent(
    role="Social Media Reviewer",
    goal="Ensure content is on-brand, platform-appropriate, and engagement-optimized.",
    backstory=(
        "You are a social media director who reviews content for brand consistency, "
        "platform fit, and engagement potential. You catch off-brand tone, "
        "weak hooks, and missed engagement opportunities."
    ),
    llm=_llm,
    verbose=False,
    allow_delegation=False,
)
