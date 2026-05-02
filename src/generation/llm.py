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


def generate(query: str, context: str) -> str:
    """
    Send query + numbered context to GPT-4o-mini, return the raw answer string.
    Temperature 0 for deterministic, citation-grounded responses.
    """
    response = client.chat.completions.create(
        model    = MODEL,
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": f"Context:\n{context}\n\nQuestion: {query}"},
        ],
        temperature = 0,
    )
    return response.choices[0].message.content.strip()
