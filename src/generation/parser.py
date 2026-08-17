"""
parser.py — Extract cited chunk numbers from the answer and map to source metadata.

Invalid citations (out of range) are silently stripped.
"""

import re

SNIPPET_CHARS = 240


def _snippet(text: str) -> str:
    """Collapse whitespace and cut to SNIPPET_CHARS on a word boundary."""
    clean = " ".join(text.split())
    if len(clean) <= SNIPPET_CHARS:
        return clean
    cut = clean[:SNIPPET_CHARS]
    return (cut[:cut.rindex(" ")] if " " in cut else cut) + "…"


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
                "number":  n,
                "title":   chunk["title"],
                "url":     chunk["url"],
                "source":  chunk.get("source", ""),
                # Cohere's relevance score for this chunk. Absent when the
                # reranker fell back to RRF order — stays None so the UI can
                # say nothing rather than invent a number.
                "score":   chunk.get("rerank_score"),
                "snippet": _snippet(chunk.get("text", "")),
            })

    return sources
