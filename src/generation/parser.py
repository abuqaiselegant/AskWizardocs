"""
parser.py — Extract cited chunk numbers from the answer and map to source metadata.

Invalid citations (out of range) are silently stripped.
"""

import re


def extract_citations(answer: str, chunks: list[dict]) -> list[dict]:
    """
    Parse [N] references from answer text.
    Returns deduplicated source list in citation order, stripping any N
    that falls outside the 1..len(chunks) range.

    Args:
        answer: raw LLM response containing [N] markers
        chunks: the same ordered list passed to the LLM as context

    Returns:
        list of dicts with keys: number, title, url
    """
    cited_numbers = [int(n) for n in re.findall(r"\[(\d+)\]", answer)]

    seen    = set()
    sources = []
    for n in cited_numbers:
        if n in seen:
            continue
        seen.add(n)
        if 1 <= n <= len(chunks):          # strip invalid / hallucinated indices
            chunk = chunks[n - 1]
            sources.append({
                "number": n,
                "title":  chunk["title"],
                "url":    chunk["url"],
            })

    return sources
