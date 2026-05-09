# run this once as a check script: check_chunks.py
import json
import tiktoken

enc = tiktoken.encoding_for_model("text-embedding-3-small")

sizes = []
with open("rag-dataset/data/processed/chunks.jsonl") as f:
    for line in f:
        chunk = json.loads(line)
        tokens = len(enc.encode(chunk["text"]))
        sizes.append(tokens)

print(f"Min: {min(sizes)}")
print(f"Max: {max(sizes)}")
print(f"Avg: {sum(sizes)//len(sizes)}")
print(f"Over 512 tokens: {sum(1 for s in sizes if s > 512)}")
