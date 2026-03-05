import os
import json
import hashlib

input_file = "data/processed/docs.jsonl"
output_file = "data/processed/chunks.jsonl"

os.makedirs("data/processed", exist_ok=True)

CHUNK_SIZE = 1200
OVERLAP = 200

def make_doc_hash(doc_id: str) -> str:
    """Small stable hash for IDs (so chunk IDs don't become huge)."""
    return hashlib.sha1(doc_id.encode("utf-8")).hexdigest()[:10]

def split_into_chunks(text: str, chunk_size: int, overlap: int):
    """
    Split text into overlapping chunks using character windows.
    Returns list of (start, end, chunk_text).
    """
    chunks = []
    start = 0
    n = len(text)

    while start < n:
        end = min(n, start + chunk_size)
        chunk_text = text[start:end]

        chunks.append((start, end, chunk_text))

        if end == n:
            break

        # move forward but keep overlap
        start = end - overlap
        if start < 0:
            start = 0

    return chunks

written = 0

with open(input_file, "r", encoding="utf-8") as fin, open(output_file, "w", encoding="utf-8") as fout:
    for line in fin:
        doc = json.loads(line)

        doc_id = doc.get("doc_id") or doc.get("url") or ""
        url = doc.get("url", "")
        title = doc.get("title", "")
        text = doc.get("text", "")

        # skip empty docs
        if not text or len(text) < 50:
            continue

        doc_hash = make_doc_hash(doc_id)

        chunks = split_into_chunks(text, CHUNK_SIZE, OVERLAP)

        for idx, (start_char, end_char, chunk_text) in enumerate(chunks):
            chunk = {
                "chunk_id": f"langchain__{doc_hash}__c{idx:04d}",
                "source": "langchain",
                "doc_id": doc_id,
                "url": url,
                "title": title,
                "chunk_index": idx,
                "loc": {"start_char": start_char, "end_char": end_char},
                "text": chunk_text
            }

            fout.write(json.dumps(chunk, ensure_ascii=False) + "\n")
            written += 1

print("✅ A4 complete")
print("Chunks written:", written)
print("Output:", output_file)