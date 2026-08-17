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


def generate_followups(question: str, answer: str) -> list[str]:
    # "the same documentation this answer came from" rather than naming a library:
    # the corpus is LangChain + HuggingFace + ChromaDB, and the source selector can
    # pin retrieval to any one of them. Naming LangChain here steered followups at
    # the wrong docs for the ~73% of chunks that aren't LangChain.
    prompt = (
        "Suggest exactly 3 short follow-up questions a user might ask next, "
        "based on this Q&A. Each must be specific, under 80 chars, and answerable "
        "from the same documentation this answer came from. "
        "Return only the 3 questions, one per line, no numbering.\n\n"
        f"Q: {question}\nA: {answer[:400]}"
    )
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
        )
        lines = [l.strip() for l in r.choices[0].message.content.splitlines() if l.strip()]
        return lines[:3]
    except Exception:
        return []
