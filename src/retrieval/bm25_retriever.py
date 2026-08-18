"""
bm25_retriever.py — Keyword retrieval over the chunk corpus using BM25.

What it does:
    Tokenises every chunk once at import → scores the query against all of them
    → returns the top-k, optionally restricted to a single source.

Why it sits alongside vector search:
    BM25 matches literal terms, so it finds exact API names, flags and error
    strings that an embedding will happily paraphrase away. hybrid_retriever.py
    fuses the two, which is why this exposes the same search() shape as
    vector_retriever.py.

The index lives in module scope: it is built once on import and every search()
reuses it. Rebuilding per request would re-tokenise all 13,280 chunks.
"""

import heapq
import json

from rank_bm25 import BM25Okapi

CHUNKS_FILE = "rag-dataset/data/processed/chunks.jsonl"


def load_chunks(filepath: str) -> list[dict]:
    """Read all chunks from jsonl into a list."""
    chunks = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            chunks.append(json.loads(line))
    return chunks


def tokenize(text: str) -> list[str]:
    """
    Split text into lowercase words.
    Simple but effective for BM25 — no need for fancy NLP here.
    """
    return text.lower().split()


def build_bm25_index(chunks: list[dict]) -> BM25Okapi:
    """
    Tokenize all chunk texts and build BM25 index.
    BM25Okapi is the standard variant — good default choice.
    """
    tokenized = [tokenize(chunk["text"]) for chunk in chunks]
    return BM25Okapi(tokenized)


def search(query: str, k: int = 10, source: str | None = None) -> list[dict]:
    """
    Search chunks by keyword overlap with query.
    Returns top-k chunks as dicts (same format as chunks.jsonl).

    Args:
        query:  natural language question
        k:      number of results to return
        source: if given, only return chunks from this source slug
    """
    tokenized_query = tokenize(query)
    scores = bm25_index.get_scores(tokenized_query)

    # Rank only the top k rather than ordering all 13,280, and filter by source
    # first so a filtered search doesn't rank rows it is about to discard.
    candidates = range(len(scores))
    if source:
        candidates = [i for i in candidates if chunks[i].get("source") == source]
    top = heapq.nlargest(k, candidates, key=lambda i: scores[i])

    return [{**chunks[i], "bm25_score": round(float(scores[i]), 4)} for i in top]


# ── Build index once when module is imported ──────────────────────────────────
# This runs once. Every call to search() reuses the same index.
print("Building BM25 index...")
chunks = load_chunks(CHUNKS_FILE)
bm25_index = build_bm25_index(chunks)
print(f"✅ BM25 index ready ({len(chunks)} chunks)")


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    results = search("How do LangChain agents work?", k=3)

    for i, r in enumerate(results):
        print(f"\n--- Result {i+1} (BM25 score: {r['bm25_score']}) ---")
        print(f"Title: {r['title']}")
        print(f"URL:   {r['url']}")
        print(f"Text:  {r['text'][:200]}...")