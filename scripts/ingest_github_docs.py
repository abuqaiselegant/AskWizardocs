"""
ingest_github_docs.py — Index HuggingFace library docs from GitHub markdown files.

Strategy:
  1. One GitHub API call per library → full recursive file tree
  2. Raw content fetched from raw.githubusercontent.com (no API rate limits)
  3. Frontmatter stripped, text chunked, embedded via OpenAI, stored in Chroma

Usage:
    python scripts/ingest_github_docs.py

Optional env var:
    GITHUB_TOKEN — increases GitHub API rate limit from 60 to 5000 req/hr.
    Set it if you see 403 errors on the tree fetch step.

After running:
    1. Restart the API server (BM25 reloads chunks.jsonl on startup)
    2. Update n=<total> for huggingface in frontend/src/chat.jsx DOC_SOURCES
"""

import hashlib
import json
import os
import re
import time
from pathlib import Path

import chromadb
import requests
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
CHUNKS_FILE = Path("rag-dataset/data/processed/chunks.jsonl")
CHROMA_DIR  = "chroma_db"
COLLECTION  = "askml_docs"
SOURCE      = "huggingface"
CHUNK_SIZE  = 1200
OVERLAP     = 200
BATCH_SIZE  = 100
EMBED_MODEL = "text-embedding-3-small"
MIN_TEXT    = 200

# (library_slug, owner/repo, doc_path_prefix, live_docs_url_base)
LIBRARIES = [
    ("hub",          "huggingface/hub-docs",    "docs/hub",       "https://huggingface.co/docs/hub"),
    ("transformers", "huggingface/transformers", "docs/source/en", "https://huggingface.co/docs/transformers/en"),
    ("peft",         "huggingface/peft",         "docs/source",    "https://huggingface.co/docs/peft/en"),
    ("trl",          "huggingface/trl",          "docs/source",    "https://huggingface.co/docs/trl/en"),
    ("diffusers",    "huggingface/diffusers",    "docs/source/en", "https://huggingface.co/docs/diffusers/en"),
    ("smolagents",   "huggingface/smolagents",   "docs/source/en", "https://huggingface.co/docs/smolagents/en"),
    ("accelerate",   "huggingface/accelerate",   "docs/source",    "https://huggingface.co/docs/accelerate/en"),
]

SKIP_FILENAMES = {"CHANGELOG.md", "CHANGES.md", "README.md", "CONTRIBUTING.md"}

# ── GitHub helpers ────────────────────────────────────────────────────────────

def _gh_headers() -> dict:
    token = os.getenv("GITHUB_TOKEN", "")
    h = {"Accept": "application/vnd.github+json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def get_md_files(repo: str, doc_path: str, branch: str = "main") -> list[dict]:
    """Return list of {path, sha} for all .md files under doc_path in repo."""
    url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
    r = requests.get(url, headers=_gh_headers(), timeout=30)
    r.raise_for_status()
    tree = r.json().get("tree", [])
    return [
        item for item in tree
        if item["type"] == "blob"
        and item["path"].startswith(doc_path)
        and item["path"].endswith(".md")
        and Path(item["path"]).name not in SKIP_FILENAMES
    ]


def fetch_raw(repo: str, path: str, branch: str = "main") -> str | None:
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    try:
        r = requests.get(url, timeout=15)
        return r.text if r.ok else None
    except Exception:
        return None


# ── Markdown processing ───────────────────────────────────────────────────────

FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)
MDCOMMENT_RE   = re.compile(r"<!--.*?-->", re.DOTALL)
CODEBLOCK_RE   = re.compile(r"```.*?```", re.DOTALL)


def clean_markdown(text: str) -> str:
    text = FRONTMATTER_RE.sub("", text)
    text = MDCOMMENT_RE.sub("", text)
    # Collapse excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_title(text: str, fallback: str) -> str:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def build_url(doc_path_prefix: str, file_path: str, docs_url_base: str) -> str:
    """Map GitHub file path to the live HuggingFace docs URL."""
    rel = file_path[len(doc_path_prefix):].lstrip("/")
    stem = rel.rsplit(".md", 1)[0]
    return f"{docs_url_base}/{stem}"


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(text: str) -> list[tuple[int, int, str]]:
    chunks, start, n = [], 0, len(text)
    while start < n:
        end = min(n, start + CHUNK_SIZE)
        chunks.append((start, end, text[start:end]))
        if end == n:
            break
        start = end - OVERLAP
    return chunks


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in resp.data]


# ── Chroma helpers ────────────────────────────────────────────────────────────

def existing_chunk_ids(collection) -> set[str]:
    total = collection.count()
    if total == 0:
        return set()
    ids = set()
    offset = 0
    while offset < total:
        result = collection.get(limit=500, offset=offset, include=[])
        ids.update(result["ids"])
        offset += 500
    return ids


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection    = chroma_client.get_or_create_collection(COLLECTION)

    print("Loading existing chunk IDs from Chroma...")
    known_ids = existing_chunk_ids(collection)
    print(f"  {len(known_ids)} chunks already indexed\n")

    CHUNKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing_jsonl_ids = set()
    if CHUNKS_FILE.exists():
        for line in CHUNKS_FILE.read_text().splitlines():
            if line.strip():
                try:
                    existing_jsonl_ids.add(json.loads(line)["chunk_id"])
                except Exception:
                    pass

    all_new_chunks: list[dict] = []

    for lib_slug, repo, doc_path, docs_url_base in LIBRARIES:
        print(f"── {lib_slug} ({repo}) ──")

        try:
            md_files = get_md_files(repo, doc_path)
        except Exception as e:
            print(f"  Failed to fetch tree: {e}")
            continue

        print(f"  {len(md_files)} .md files found")
        lib_chunks = 0

        for i, item in enumerate(md_files, 1):
            file_path = item["path"]
            raw = fetch_raw(repo, file_path)
            if not raw:
                continue

            text = clean_markdown(raw)
            if len(text) < MIN_TEXT:
                continue

            title    = extract_title(text, Path(file_path).stem.replace("-", " ").replace("_", " ").title())
            live_url = build_url(doc_path, file_path, docs_url_base)
            doc_hash = hashlib.sha1(live_url.encode()).hexdigest()[:10]

            for idx, (start, end, chunk_text_) in enumerate(chunk_text(text)):
                cid = f"hf_{lib_slug}__{doc_hash}__c{idx:04d}"
                if cid in known_ids or cid in existing_jsonl_ids:
                    continue
                all_new_chunks.append({
                    "chunk_id":    cid,
                    "source":      SOURCE,
                    "library":     lib_slug,
                    "doc_id":      live_url,
                    "url":         live_url,
                    "title":       f"{lib_slug.title()}: {title}",
                    "chunk_index": idx,
                    "loc":         {"start_char": start, "end_char": end},
                    "text":        chunk_text_,
                })
                lib_chunks += 1

            if i % 50 == 0:
                print(f"  Processed {i}/{len(md_files)} files...")
            time.sleep(0.05)  # gentle rate-limiting for raw content fetches

        print(f"  → {lib_chunks} new chunks from {lib_slug}\n")

    print(f"Total new chunks to embed: {len(all_new_chunks)}")
    if not all_new_chunks:
        print("Nothing new. Done.")
        return

    # ── Embed + store in Chroma ────────────────────────────────────────────────
    stored = 0
    for start in range(0, len(all_new_chunks), BATCH_SIZE):
        batch     = all_new_chunks[start : start + BATCH_SIZE]
        ids       = [c["chunk_id"]   for c in batch]
        texts     = [c["text"]       for c in batch]
        metadatas = [
            {
                "source":      c["source"],
                "library":     c["library"],
                "url":         c["url"],
                "title":       c["title"],
                "chunk_index": c["chunk_index"],
                "chunk_id":    c["chunk_id"],
            }
            for c in batch
        ]
        vectors = embed_batch(openai_client, texts)
        collection.add(ids=ids, embeddings=vectors, documents=texts, metadatas=metadatas)
        stored += len(batch)
        print(f"  Embedded {stored}/{len(all_new_chunks)}...")

    # ── Append to chunks.jsonl ─────────────────────────────────────────────────
    raw_bytes = CHUNKS_FILE.read_bytes() if CHUNKS_FILE.exists() else b""
    with CHUNKS_FILE.open("a", encoding="utf-8") as f:
        if raw_bytes and not raw_bytes.endswith(b"\n"):
            f.write("\n")
        for c in all_new_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    hf_total = sum(1 for c in all_new_chunks) + sum(
        1 for cid in known_ids if cid.startswith("hf_") or cid.startswith("huggingface")
    )

    print(f"\n✅ Done: {stored} new HuggingFace chunks indexed")
    print(f"   Total chunks in collection: {collection.count()}")
    print(f"\nNext steps:")
    print(f"  1. Restart the API server (BM25 reloads chunks.jsonl on startup)")
    print(f"  2. Update n=<count> for huggingface in frontend/src/chat.jsx DOC_SOURCES")


if __name__ == "__main__":
    main()
