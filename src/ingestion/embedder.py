"""
embedder.py — Embeds chunks and stores them in ChromaDB.

What it does:
  Reads chunks.jsonl → calls OpenAI embeddings API in batches
  → stores text + vector + metadata in a local Chroma collection.

Why batching:
  Sending one chunk at a time = 3422 API calls. Batching = ~35 calls. Faster + cheaper.

Why idempotent:
  Chroma skips chunk_ids that already exist, so re-running won't double-embed or charge you twice.

Inputs:  rag-dataset/data/processed/chunks.jsonl
Outputs: chroma_db/ (created automatically, persists to disk)
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
import chromadb

# Importable whether this is run as `python src/ingestion/embedder.py` or
# `python -m src.ingestion.embedder`.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.ingestion.chunk_schema import chunk_metadata   # noqa: E402

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
CHUNKS_FILE = "rag-dataset/data/processed/chunks.jsonl"
CHROMA_DIR  = "chroma_db"
COLLECTION  = "askml_docs"
BATCH_SIZE  = 100
EMBED_MODEL = "text-embedding-3-small"

# ── Clients ───────────────────────────────────────────────────────────────────
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
collection    = chroma_client.get_or_create_collection(name=COLLECTION)


def load_chunks(filepath: str) -> list[dict]:
    """Read all chunks from jsonl file into a list of dicts."""
    chunks = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            chunks.append(json.loads(line))
    return chunks


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    Send a batch of texts to OpenAI and return their vectors.
    Returns a list of vectors (each vector = list of 1536 floats).
    """
    response = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=texts
    )
    # response.data is sorted by index, so order is preserved
    return [item.embedding for item in response.data]


def store_chunks(chunks: list[dict]) -> None:
    """
    Embed chunks in batches and store in Chroma.
    Skips chunks whose chunk_id already exists (idempotent).
    """
    total = len(chunks)
    stored = 0

    for batch_start in range(0, total, BATCH_SIZE):
        batch = chunks[batch_start : batch_start + BATCH_SIZE]

        # extract fields
        ids       = [c["chunk_id"] for c in batch]
        texts     = [c["text"]     for c in batch]
        # chunk_metadata() guarantees chunk_id is in here. This file is where it
        # was once missing — vector_retriever.py reads meta.get("chunk_id", "")
        # and hybrid_retriever.py keys RRF fusion on that value, so without it
        # every vector hit collapses into a single "" entry, the worst-ranked one
        # wins, and its summed score pins it to rank 1 ahead of every BM25 result.
        # Silent, and visible only as bad answers. Four writers used to build this
        # dict independently; now there is one.
        metadatas = [chunk_metadata(c) for c in batch]

        # embed
        vectors = embed_batch(texts)

        # store — Chroma skips existing ids automatically
        collection.add(
            ids        = ids,
            embeddings = vectors,
            documents  = texts,
            metadatas  = metadatas,
        )

        stored += len(batch)
        print(f"  Stored {stored}/{total} chunks...")

    print(f"\n✅ Done. {stored} chunks stored in '{COLLECTION}' collection.")


if __name__ == "__main__":
    print("Loading chunks...")
    chunks = load_chunks(CHUNKS_FILE)
    print(f"Loaded {len(chunks)} chunks\n")

    print("Embedding + storing in Chroma...")
    store_chunks(chunks)

    print(f"\nChroma DB saved to: {CHROMA_DIR}/")
