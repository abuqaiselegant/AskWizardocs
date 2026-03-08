"""
reranker.py — Cross-encoder reranking using Cohere Rerank API.

What it does:
    Takes top-20 hybrid results + original query → sends to Cohere
    cross-encoder → gets back relevance scores → returns top-5
    correctly ordered by true relevance.

Why cross-encoder:
    Hybrid retrieval ranks by keyword/semantic overlap separately.
    Cross-encoder reads query AND chunk together — much more accurate
    at judging "does this chunk actually answer this question?"

Why top 20 → top 5:
    20 gives the reranker enough candidates to find the best ones.
    5 is enough context for the LLM in Phase 4 without overwhelming it.

Input:  query string + list of chunk dicts (from hybrid retriever)
Output: top 5 chunk dicts with rerank_score attached
"""

import os
import cohere
from dotenv import load_dotenv

load_dotenv()

# ── Client ────────────────────────────────────────────────────────────────────
cohere_client = cohere.Client(api_key=os.getenv("COHERE_API_KEY"))

RERANK_MODEL  = "rerank-english-v3.0"  # best english reranker from Cohere
TOP_N         = 5                       # how many to return after reranking


def rerank(query: str, chunks: list[dict]) -> list[dict]:
    """
    Rerank chunks by true relevance to query using Cohere cross-encoder.

    Args:
        query:  the user's question
        chunks: list of chunk dicts from hybrid retriever (up to 20)

    Returns:
        top 5 chunks sorted by relevance_score descending
    """

    # cohere expects plain strings, not dicts
    # we extract just the text, but keep original dicts to return later
    texts = [chunk["text"] for chunk in chunks]

    # send to cohere — it reads each (query, text) pair together
    response = cohere_client.rerank(
        model     = RERANK_MODEL,
        query     = query,
        documents = texts,
        top_n     = TOP_N,
    )

    # response.results is sorted by relevance (best first)
    # each result has .index (position in texts list) and .relevance_score
    reranked = []
    for result in response.results:
        chunk = chunks[result.index].copy()
        chunk["rerank_score"] = round(result.relevance_score, 4)
        reranked.append(chunk)

    return reranked


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # simulate what hybrid retriever returns
    # in real usage this comes from hybrid_retriever.search()
    from src.retrieval.hybrid_retriever import search as hybrid_search

    query   = "How do LangChain agents work?"
    chunks  = hybrid_search(query, k=20)

    print(f"Query: {query}")
    print(f"Hybrid returned {len(chunks)} chunks → reranking to top {TOP_N}\n")

    results = rerank(query, chunks)

    for i, r in enumerate(results):
        print(f"--- Result {i+1} (rerank score: {r['rerank_score']}) ---")
        print(f"Title: {r['title']}")
        print(f"URL:   {r['url']}")
        print(f"Text:  {r['text'][:200]}...")
        print()