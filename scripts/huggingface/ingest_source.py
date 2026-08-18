"""
ingest_source.py — Add a new documentation source to Wizardocs.

Usage:
    python scripts/ingest_source.py \\
        --source huggingface \\
        --sitemap-url https://huggingface.co/sitemap.xml \\
        --url-prefix https://huggingface.co/docs

    python scripts/ingest_source.py \\
        --source chromadb \\
        --sitemap-url https://docs.trychroma.com/sitemap.xml

Options:
    --source        Slug used in chunk metadata and source filter (e.g. huggingface)
    --sitemap-url   URL of the XML sitemap for the docs site
    --url-prefix    Only index URLs that start with this prefix (optional)
    --limit         Max pages to index — useful for testing (optional)

After running:
    1. Restart the API server so BM25 reloads chunks.jsonl with the new chunks.
    2. Set live: true for this source in frontend/src/chat.jsx DOC_SOURCES.
"""

import argparse
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import chromadb
import requests
import trafilatura
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from openai import OpenAI

# Run from the repo root, which puts this file's directory on sys.path rather
# than the project root — so the shared chunk schema needs the hint.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from src.ingestion.chunk_schema import chunk_metadata, make_chunk   # noqa: E402

load_dotenv()

CHUNKS_FILE = Path("rag-dataset/data/processed/chunks.jsonl")
CHROMA_DIR  = "chroma_db"
COLLECTION  = "askml_docs"
CHUNK_SIZE  = 1200
OVERLAP     = 200
BATCH_SIZE  = 100
EMBED_MODEL = "text-embedding-3-small"
MIN_TEXT    = 300


def fetch_sitemap_urls(sitemap_url: str, url_prefix: str | None) -> list[str]:
    print(f"Fetching sitemap: {sitemap_url}")
    resp = requests.get(sitemap_url, timeout=30)
    resp.raise_for_status()

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        raise SystemExit(f"Failed to parse sitemap XML: {e}")

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    # Handle sitemap index (sitemap of sitemaps)
    sub_sitemaps = root.findall("sm:sitemap/sm:loc", ns)
    if sub_sitemaps:
        # url_prefix filters the page URLs below, not the index entries here.
        all_urls = []
        for loc in sub_sitemaps:
            all_urls.extend(fetch_sitemap_urls(loc.text.strip(), url_prefix))
        return all_urls

    urls = []
    for loc in root.findall("sm:url/sm:loc", ns):
        url = loc.text.strip()
        if url_prefix and not url.startswith(url_prefix):
            continue
        urls.append(url)

    return sorted(set(urls))


def download_page(url: str) -> str | None:
    try:
        resp = requests.get(url, timeout=30)
        return resp.text
    except Exception as e:
        print(f"  Download failed: {url} — {e}")
        return None


def extract_text(html: str) -> str | None:
    return trafilatura.extract(html)


def get_title(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    return soup.title.text.strip() if soup.title else ""


def chunk_text(text: str) -> list[tuple[int, int, str]]:
    chunks, start, n = [], 0, len(text)
    while start < n:
        end = min(n, start + CHUNK_SIZE)
        chunks.append((start, end, text[start:end]))
        if end == n:
            break
        start = end - OVERLAP
    return chunks


def existing_chunk_ids(collection) -> set[str]:
    total = collection.count()
    if total == 0:
        return set()
    all_ids = set()
    offset = 0
    batch  = 500
    while offset < total:
        result = collection.get(limit=batch, offset=offset, include=[])
        all_ids.update(result["ids"])
        offset += batch
    return all_ids


def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [item.embedding for item in resp.data]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source",      required=True, help="Source slug, e.g. huggingface")
    parser.add_argument("--sitemap-url", required=True, help="URL to the docs sitemap.xml")
    parser.add_argument("--url-prefix",  default=None,  help="Only index URLs starting with this prefix")
    parser.add_argument("--limit",       type=int, default=None, help="Max pages (for testing)")
    args = parser.parse_args()

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection    = chroma_client.get_or_create_collection(COLLECTION)

    # ── 1. URLs ────────────────────────────────────────────────────────────────
    urls = fetch_sitemap_urls(args.sitemap_url, args.url_prefix)
    if args.limit:
        urls = urls[:args.limit]
    print(f"Found {len(urls)} URLs to index\n")

    # ── 2. Load existing chunk IDs so we stay idempotent ──────────────────────
    print("Loading existing chunk IDs from Chroma...")
    known_ids = existing_chunk_ids(collection)
    print(f"  {len(known_ids)} chunks already indexed\n")

    # ── 3. Load existing chunks.jsonl ─────────────────────────────────────────
    CHUNKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    existing_jsonl: list[dict] = []
    if CHUNKS_FILE.exists():
        existing_jsonl = [json.loads(l) for l in CHUNKS_FILE.read_text().splitlines() if l.strip()]
    existing_jsonl_ids = {c["chunk_id"] for c in existing_jsonl}

    # ── 4. Download → extract → chunk → collect new chunks ────────────────────
    new_chunks: list[dict] = []

    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}] {url}")
        html = download_page(url)
        if not html:
            continue

        text = extract_text(html)
        if not text or len(text) < MIN_TEXT:
            print(f"  Skipped (too short or no content)")
            continue

        title = get_title(html)

        for idx, (start, end, chunk_text_) in enumerate(chunk_text(text)):
            chunk = make_chunk(
                source     = args.source,
                doc_id     = url,
                url        = url,
                title      = title,
                index      = idx,
                start_char = start,
                end_char   = end,
                text       = chunk_text_,
            )
            if chunk["chunk_id"] in known_ids or chunk["chunk_id"] in existing_jsonl_ids:
                continue
            new_chunks.append(chunk)

        time.sleep(0.3)

    print(f"\n{len(new_chunks)} new chunks to embed\n")
    if not new_chunks:
        print("Nothing new to index. Done.")
        return

    # ── 5. Embed + store in Chroma ─────────────────────────────────────────────
    stored = 0
    for start in range(0, len(new_chunks), BATCH_SIZE):
        batch     = new_chunks[start : start + BATCH_SIZE]
        ids       = [c["chunk_id"]   for c in batch]
        texts     = [c["text"]       for c in batch]
        metadatas = [chunk_metadata(c) for c in batch]
        vectors = embed_batch(openai_client, texts)
        collection.add(ids=ids, embeddings=vectors, documents=texts, metadatas=metadatas)
        stored += len(batch)
        print(f"  Embedded {stored}/{len(new_chunks)}...")

    # ── 6. Append to chunks.jsonl ──────────────────────────────────────────────
    raw = CHUNKS_FILE.read_bytes() if CHUNKS_FILE.exists() else b""
    with CHUNKS_FILE.open("a", encoding="utf-8") as f:
        if raw and not raw.endswith(b"\n"):
            f.write("\n")
        for c in new_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")

    print(f"\n✅ Done: {stored} new chunks indexed for source='{args.source}'")
    print(f"   Total chunks in collection: {collection.count()}")
    print(f"\nNext steps:")
    print(f"  1. Restart the API server (BM25 reloads chunks.jsonl on startup)")
    print(f"  2. Set live: true for '{args.source}' in frontend/src/chat.jsx DOC_SOURCES")


if __name__ == "__main__":
    main()
