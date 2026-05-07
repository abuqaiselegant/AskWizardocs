"""
hybrid_retriever.py — Combines BM25 + vector search using RRF fusion.

What it does:
    Runs both retrievers on the same query → merges ranked lists
    using Reciprocal Rank Fusion → returns unified top-k results.

Why RRF:
    Each retriever returns results in ranked order (rank 1 = best).
    RRF formula: score = 1 / (60 + rank)
    A chunk appearing at rank 2 in both lists scores higher than
    a chunk appearing at rank 1 in only one list.
    The 60 constant prevents top ranks from dominating too much.

Why not just merge scores directly:
    BM25 scores (0-15) and vector scores (0-1) are on different scales.
    RRF uses only rank position — scale doesn't matter.

Input:  query string
Output: list of chunk dicts ranked by combined RRF score
"""

from src.retrieval.reranker import rerank
from src.retrieval.bm25_retriever import search as bm25_search
from src.retrieval.vector_retriever import search as vector_search

RRF_K = 60  # standard constant, don't change unless experimenting


def reciprocal_rank_fusion(
    bm25_results: list[dict],
    vector_results: list[dict],
) -> list[dict]:
    """
    Merge two ranked lists using RRF.

    For each chunk, score = 1/(60 + rank_in_bm25) + 1/(60 + rank_in_vector)
    Chunks only in one list still get a partial score.
    Returns chunks sorted by combined RRF score descending.
    """
    rrf_scores = {}  # chunk_id → combined score
    all_chunks  = {}  # chunk_id → chunk dict (to reconstruct results)

    # score BM25 results by rank position
    for rank, chunk in enumerate(bm25_results):
        cid = chunk["chunk_id"]
        rrf_scores[cid]  = rrf_scores.get(cid, 0) + 1 / (RRF_K + rank + 1)
        all_chunks[cid]  = chunk

    # add vector scores by rank position
    for rank, chunk in enumerate(vector_results):
        cid = chunk["chunk_id"]
        rrf_scores[cid]  = rrf_scores.get(cid, 0) + 1 / (RRF_K + rank + 1)
        all_chunks[cid]  = chunk

    # sort by combined RRF score
    sorted_ids = sorted(rrf_scores, key=lambda x: rrf_scores[x], reverse=True)

    # build final result list
    results = []
    for cid in sorted_ids:
        chunk = all_chunks[cid].copy()
        chunk["rrf_score"] = round(rrf_scores[cid], 6)
        results.append(chunk)

    return results


def search(query: str, k: int = 10, source: str | None = None) -> list[dict]:
    """
    Hybrid search: BM25 + vector → RRF fusion → top-k results.

    Args:
        query:  natural language question
        k:      number of final results to return
        source: if given, restrict both retrievers to this source slug
    """
    bm25_results   = bm25_search(query,   k=20, source=source)
    vector_results = vector_search(query, k=20, source=source)

    fused = reciprocal_rank_fusion(bm25_results, vector_results)
    return fused[:k]


def search_with_rerank(query: str, source: str | None = None) -> list[dict]:
    """
    Full pipeline: hybrid retrieval → reranking.
    This is the main entry point for generation.

    Returns top 5 chunks, correctly ordered by true relevance.
    """
    candidates = search(query, k=20, source=source)
    return rerank(query, candidates)


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    query = "How do LangChain agents work?"

    print("=== HYBRID ONLY (top 5) ===")
    for i, r in enumerate(search(query, k=5)):
        print(f"{i+1}. {r['title']} (rrf: {r['rrf_score']})")

    print("\n=== HYBRID + RERANK (top 5) ===")
    for i, r in enumerate(search_with_rerank(query)):
        print(f"{i+1}. {r['title']} (rerank: {r['rerank_score']})")