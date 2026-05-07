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

    sorted_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)

    results = []
    for idx in sorted_indices:
        if source and chunks[idx].get("source") != source:
            continue
        chunk = chunks[idx].copy()
        chunk["bm25_score"] = round(float(scores[idx]), 4)
        results.append(chunk)
        if len(results) >= k:
            break

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