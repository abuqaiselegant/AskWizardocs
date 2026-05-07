"""
generator.py — Phase 4 entry point. ask(query) → answer + cited sources.
"""

from src.retrieval.hybrid_retriever import search_with_rerank
from src.generation.formatter import format_context
from src.generation.llm      import generate as llm_generate, generate_followups
from src.generation.parser   import extract_citations


def generate(query: str, chunks: list[dict], history: list[dict] | None = None) -> dict:
    context = format_context(chunks)
    answer  = llm_generate(query, context, history)
    sources = extract_citations(answer, chunks)
    # Use top reranked chunk's score as confidence (reranker returns 0-1)
    confidence = round(chunks[0].get("rerank_score", 0.78), 4) if chunks else 0.62
    return {"answer": answer, "sources": sources, "confidence": confidence}


def ask(query: str, history: list[dict] | None = None) -> dict:
    # For follow-up questions ("give in description", "summarise", etc.) the bare
    # query has no retrievable keywords. Prepend the last user turn so the
    # retriever searches in the right topic area.
    retrieval_query = query
    if history:
        last_user = next((h["content"] for h in reversed(history) if h["role"] == "user"), None)
        if last_user:
            retrieval_query = f"{last_user} {query}"

    chunks = search_with_rerank(retrieval_query)
    result = generate(query, chunks, history)
    result["followups"] = generate_followups(query, result["answer"])
    return result


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    from src.retrieval.hybrid_retriever import search_with_rerank

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
