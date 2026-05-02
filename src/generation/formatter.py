"""
formatter.py — Format retrieved chunks into a numbered context block.

Each chunk becomes [N] text so the LLM can cite by number.
"""


def format_context(chunks: list[dict]) -> str:
    """
    Turn top-5 chunk dicts into a single numbered string.

    Example output:
        [1] LangChain agents use LangGraph persistence...

        [2] At its core, LangGraph models agent workflows...
    """
    parts = [f"[{i}] {chunk['text'].strip()}" for i, chunk in enumerate(chunks, 1)]
    return "\n\n".join(parts)
