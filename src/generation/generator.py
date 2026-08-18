"""
generator.py — Phase 4 entry point. ask(query) → answer + cited sources.
"""

from src.retrieval.hybrid_retriever import search_with_rerank
from src.generation.formatter import format_context
from src.generation.llm      import generate as llm_generate, generate_followups
from src.generation.llm      import generate_stream as llm_generate_stream
from src.generation.parser   import extract_citations


def generate(query: str, chunks: list[dict], history: list[dict] | None = None) -> dict:
    context = format_context(chunks)
    answer  = llm_generate(query, context, history)
    sources = extract_citations(answer, chunks)
    # Confidence is the top reranked chunk's score (reranker returns 0-1).
    # None when there is no score to report — no chunks, or the Cohere fallback
    # returned RRF order without one. The old default of 0.78 rendered as a
    # "medium · 78%" meter that was invented, which is the same thing the
    # per-source scores stopped doing when they became nullable (parser.py).
    return {"answer": answer, "sources": sources, "confidence": confidence_of(chunks)}


def retrieval_query(query: str, history: list[dict] | None = None) -> str:
    """What actually goes to the retriever.

    For follow-up questions ("give in description", "summarise", etc.) the bare
    query has no retrievable keywords. Prepend the last user turn so the
    retriever searches in the right topic area.

    Shared by ask() and ask_stream() so the two cannot retrieve differently for
    the same question — a divergence that would show up as "the streamed answer
    is worse" with nothing in the logs to explain it.
    """
    if history:
        last_user = next((h["content"] for h in reversed(history) if h["role"] == "user"), None)
        if last_user:
            return f"{last_user} {query}"
    return query


def confidence_of(chunks: list[dict]) -> float | None:
    """Top chunk's reranker score, or None when there is no real score to report."""
    top = chunks[0].get("rerank_score") if chunks else None
    return round(top, 4) if top is not None else None


def ask(query: str, history: list[dict] | None = None, source: str | None = None) -> dict:
    chunks = search_with_rerank(retrieval_query(query, history), source=source)
    result = generate(query, chunks, history)
    result["followups"] = generate_followups(query, result["answer"])
    return result


def ask_stream(query: str, history: list[dict] | None = None, source: str | None = None):
    """Same pipeline as ask(), yielding (event, payload) as the answer is produced.

        ("meta",  {"confidence": float | None})   once, before the first token
        ("delta", str)                            each text fragment
        ("done",  {answer, sources, followups})   once, after generation

    Retrieval and reranking cannot stream — they must finish before a first
    token exists — so `meta` is emitted the moment they do. That is also when
    the confidence is known, since it is the top chunk's rerank score and owes
    nothing to the generated text.

    Follow-ups stay a second, blocking LLM call, but they now happen *after* the
    answer has reached the reader instead of in front of it.
    """
    chunks  = search_with_rerank(retrieval_query(query, history), source=source)
    yield ("meta", {"confidence": confidence_of(chunks)})

    context = format_context(chunks)
    parts: list[str] = []
    for fragment in llm_generate_stream(query, context, history):
        if not parts:
            # generate() strips the finished answer. Drop leading whitespace here
            # too, so what the reader sees matches what is parsed and stored
            # rather than starting one stray newline lower.
            fragment = fragment.lstrip()
            if not fragment:
                continue
        parts.append(fragment)
        yield ("delta", fragment)

    answer = "".join(parts).strip()
    yield ("done", {
        "answer":    answer,
        "sources":   extract_citations(answer, chunks),
        "followups": generate_followups(query, answer),
    })


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    query   = "How do LangChain agents work?"
    chunks  = search_with_rerank(query)

    print(f"Query: {query}\n")
    result  = generate(query, chunks)

    print("=== ANSWER ===")
    print(result["answer"])

    print("\n=== CITED SOURCES ===")
    for s in result["sources"]:
        print(f"[{s['number']}] {s['title']}")
        print(f"    {s['url']}")
