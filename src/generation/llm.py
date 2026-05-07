"""
llm.py — GPT-4o-mini call for answer generation.
"""

import os
from openai import OpenAI
from dotenv import load_dotenv
from src.generation.prompt import SYSTEM_PROMPT

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL  = "gpt-4o-mini"


def generate(query: str, context: str, history: list[dict] | None = None) -> str:
    """
    Send query + context (+ optional conversation history) to GPT-4o-mini.
    history: [{"role": "user"|"assistant", "content": str}, ...] oldest-first.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in (history or []):
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"})

    response = client.chat.completions.create(
        model=MODEL, messages=messages, temperature=0,
    )
    return response.choices[0].message.content.strip()
