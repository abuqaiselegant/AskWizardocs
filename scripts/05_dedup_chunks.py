"""
05_dedup_chunks.py — Remove duplicate chunks and re-embed into ChromaDB.

Dedup strategy:
    Group by MD5(text). For Python/JS mirrors keep the Python URL.
    For any other duplicates keep first seen.
    Then clear ChromaDB and re-embed from scratch.

Stats (expected): 3422 → 3235 chunks (-187 duplicates)
"""

import hashlib
import json
import os
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

CHUNKS_FILE = Path("rag-dataset/data/processed/chunks.jsonl")
CHROMA_DIR  = "chroma_db"
COLLECTION  = "askml_docs"
BATCH_SIZE  = 100
EMBED_MODEL = "text-embedding-3-small"

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ── Step 1: dedup ──────────────────────────────────────────────────────────────

def dedup(chunks: list[dict]) -> list[dict]:
    seen:   dict[str, dict] = {}   # md5 → chosen chunk

    for chunk in chunks:
        h = hashlib.md5(chunk["text"].encode()).hexdigest()

        if h not in seen:
            seen[h] = chunk
        else:
            existing_url = seen[h]["url"]
            current_url  = chunk["url"]
            # prefer Python URL over JS mirror
            if "/javascript/" in existing_url and "/python/" in current_url:
                seen[h] = chunk

    return list(seen.values())


# ── Step 2: embed + store ──────────────────────────────────────────────────────

def embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in response.data]


def reembed(chunks: list[dict]) -> None:
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)

    # clear existing collection so stale chunk_ids don't linger
    try:
        chroma_client.delete_collection(COLLECTION)
        print(f"Cleared existing '{COLLECTION}' collection.")
    except Exception:
        pass

    collection = chroma_client.create_collection(COLLECTION)
    total  = len(chunks)
    stored = 0

    for start in range(0, total, BATCH_SIZE):
        batch     = chunks[start : start + BATCH_SIZE]
        ids       = [c["chunk_id"]   for c in batch]
        texts     = [c["text"]       for c in batch]
        metadatas = [
            {
                "source":      c["source"],
                "url":         c["url"],
                "title":       c["title"],
                "chunk_index": c["chunk_index"],
                "chunk_id":    c["chunk_id"],
            }
            for c in batch
        ]
        vectors = embed_batch(texts)
        collection.add(ids=ids, embeddings=vectors, documents=texts, metadatas=metadatas)
        stored += len(batch)
        print(f"  Embedded {stored}/{total}...")

    print(f"\n✅ Re-embedded {stored} chunks into '{COLLECTION}'.")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Loading chunks...")
    chunks = [json.loads(l) for l in CHUNKS_FILE.read_text().splitlines() if l.strip()]
    print(f"  Loaded: {len(chunks)} chunks")

    print("\nDeduplicating...")
    deduped = dedup(chunks)
    removed = len(chunks) - len(deduped)
    print(f"  Removed: {removed} duplicates")
    print(f"  Remaining: {len(deduped)} chunks")

    print("\nWriting deduped chunks.jsonl...")
    CHUNKS_FILE.write_text("\n".join(json.dumps(c) for c in deduped))
    print("  Done.")

    print("\nRe-embedding into ChromaDB...")
    reembed(deduped)

    print(f"\n✅ Phase 6 dedup complete: {len(chunks)} → {len(deduped)} chunks.")
