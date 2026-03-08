"""
vector_retriever.py — Semantic retrieval using Chroma + OpenAI embeddings.

What it does:
    Embeds the query → searches Chroma for closest chunk vectors →
    returns top-k chunks ranked by semantic similarity.

Why same interface as BM25:
    hybrid_retriever.py will call both search() functions the same way
    and merge results. Consistent interface = simple fusion code.

Input:  query string
Output: list of chunk dicts ranked by semantic similarity
"""

import os
from dotenv import load_dotenv
from openai import OpenAI
import chromadb

load_dotenv()

CHROMA_DIR  = "chroma_db"
COLLECTION  = "askml_docs"
EMBED_MODEL = "text-embedding-3-small"

# ── Clients (initialised once on import) ─────────────────────────────────────
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection    = chroma_client.get_collection(COLLECTION)


def embed_query(query: str) -> list[float]:
    """
    Convert query text into a vector using OpenAI.
    Same model used during ingestion — must match.
    """
    response = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=[query]
    )
    return response.data[0].embedding


def search(query: str, k: int = 10) -> list[dict]:
    """
    Search Chroma for chunks semantically similar to query.
    Returns top-k chunks as dicts with vector_score attached.

    Args:
        query: natural language question
        k:     number of results to return
    """
    vector = embed_query(query)

    results = collection.query(
        query_embeddings=[vector],
        n_results=k,
        include=["documents", "metadatas", "distances"]
    )

    # Chroma returns distance (lower = more similar)
    # We convert to a similarity score (higher = better) for clarity
    chunks = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    ):
        chunk = {
            "chunk_id":    meta.get("chunk_id", ""),
            "source":      meta["source"],
            "url":         meta["url"],
            "title":       meta["title"],
            "chunk_index": meta["chunk_index"],
            "text":        doc,
            "vector_score": round(1 - (dist / 2), 4)
        }
        chunks.append(chunk)

    return chunks


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    results = search("How do LangChain agents work?", k=3)

    for i, r in enumerate(results):
        print(f"\n--- Result {i+1} (vector score: {r['vector_score']}) ---")
        print(f"Title: {r['title']}")
        print(f"URL:   {r['url']}")
        print(f"Text:  {r['text'][:200]}...")