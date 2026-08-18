import os
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.ingestion.chunk_schema import make_chunk   # noqa: E402

input_file = "rag-dataset/data/processed/docs.jsonl"
output_file = "rag-dataset/data/processed/chunks.jsonl"

os.makedirs("data/processed", exist_ok=True)

CHUNK_SIZE = 1200
OVERLAP = 200

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

        chunks = split_into_chunks(text, CHUNK_SIZE, OVERLAP)

        for idx, (start_char, end_char, chunk_text) in enumerate(chunks):
            chunk = make_chunk(
                source     = "langchain",
                doc_id     = doc_id,
                url        = url,
                title      = title,
                index      = idx,
                start_char = start_char,
                end_char   = end_char,
                text       = chunk_text,
            )

            fout.write(json.dumps(chunk, ensure_ascii=False) + "\n")
            written += 1

print("✅ A4 complete")
print("Chunks written:", written)
print("Output:", output_file)