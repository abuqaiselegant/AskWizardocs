"""
generator.py — Phase 4 entry point. ask(query) → answer + cited sources.
"""

from src.retrieval.hybrid_retriever import search_with_rerank
from src.generation.formatter import format_context
from src.generation.llm      import generate as llm_generate
from src.generation.parser   import extract_citations


def generate(query: str, chunks: list[dict]) -> dict:
    """
    Format chunks → call LLM → parse citations.

    Args:
        query:  user question
        chunks: top-5 reranked chunk dicts from search_with_rerank()

    Returns:
        {
            "answer":  str,
            "sources": [{"number": int, "title": str, "url": str}, ...]
        }
    """
    context = format_context(chunks)
    answer  = llm_generate(query, context)
    sources = extract_citations(answer, chunks)
    return {"answer": answer, "sources": sources}


def ask(query: str) -> dict:
    """
    Full RAG pipeline: retrieve → generate → return answer + sources.
    """
    chunks = search_with_rerank(query)
    return generate(query, chunks)


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
