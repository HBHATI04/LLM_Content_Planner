from crewai import LLM
import os
from dotenv import load_dotenv

load_dotenv()

llm = LLM(
    model="meta/llama-3.1-8b-instruct",
    api_key=os.getenv("NVIDIA_API_KEY"),
    base_url="https://integrate.api.nvidia.com/v1",
    provider="openai",
    temperature=0.65,
    max_tokens=800,
    tools=None
)