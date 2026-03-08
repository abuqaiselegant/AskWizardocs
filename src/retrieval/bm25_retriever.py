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


def search(query: str, k: int = 10) -> list[dict]:
    """
    Search chunks by keyword overlap with query.
    Returns top-k chunks as dicts (same format as chunks.jsonl).

    Args:
        query: natural language question
        k:     number of results to return
    """
    # tokenize the query the same way as the chunks
    tokenized_query = tokenize(query)

    # get BM25 scores for all chunks
    scores = bm25_index.get_scores(tokenized_query)

    # get indices of top-k scores (sorted highest first)
    top_indices = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True
    )[:k]

    # return the actual chunk dicts with scores attached
    results = []
    for idx in top_indices:
        chunk = chunks[idx].copy()
        chunk["bm25_score"] = round(float(scores[idx]), 4)
        results.append(chunk)

    return results


# ── Build index once when module is imported ──────────────────────────────────
# This runs once. Every call to search() reuses the same index.
print("Building BM25 index...")
chunks = load_chunks(CHUNKS_FILE)
bm25_index = BM25Okapi([tokenize(c["text"]) for c in chunks])
print(f"✅ BM25 index ready ({len(chunks)} chunks)")


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    results = search("How do LangChain agents work?", k=3)

    for i, r in enumerate(results):
        print(f"\n--- Result {i+1} (BM25 score: {r['bm25_score']}) ---")
        print(f"Title: {r['title']}")
        print(f"URL:   {r['url']}")
        print(f"Text:  {r['text'][:200]}...")