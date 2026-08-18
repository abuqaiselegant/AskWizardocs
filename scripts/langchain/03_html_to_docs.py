"""
03 — Raw HTML → clean documents.

Step 3 of the LangChain HTML pipeline. Runs each downloaded page through
trafilatura, which strips navigation, sidebars and footers and leaves the article
text, and takes the title from the <title> tag. Writes one JSON object per
document to rag-dataset/data/processed/docs.jsonl.

Pages yielding under MIN_TEXT_LEN characters are dropped — mostly redirects and
index stubs, which add noise to retrieval without adding anything to answer from.

Incremental: URLs already present in docs.jsonl are skipped on a re-run.
"""

import os
import json
import trafilatura
from bs4 import BeautifulSoup

# Input folder containing downloaded HTML + URL files
input_folder = "rag-dataset/data/raw/langchain_html"

# Output JSONL file
output_file = "rag-dataset/data/processed/docs.jsonl"

os.makedirs("rag-dataset/data/processed", exist_ok=True)

MIN_TEXT_LEN = 300

def get_title_from_html(html_text):
    """Extract the <title> tag from HTML."""
    soup = BeautifulSoup(html_text, "lxml")
    if soup.title and soup.title.text:
        return soup.title.text.strip()
    return ""

def extract_main_text(html_text):
    """Extract main readable content, strips nav/footer automatically."""
    return trafilatura.extract(html_text)

# ── Step 1: Load already-processed URLs ───────────────────────────────────────
existing_urls = set()
if os.path.exists(output_file):
    with open(output_file, "r", encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line)
            existing_urls.add(doc["url"])

print(f"Already processed: {len(existing_urls)} docs")

# ── Step 2: Process new HTML files only ───────────────────────────────────────
html_files = sorted([f for f in os.listdir(input_folder) if f.endswith(".html")])

written = 0
skipped = 0

with open(output_file, "a", encoding="utf-8") as out:
    for html_name in html_files:
        html_path = os.path.join(input_folder, html_name)
        url_path  = html_path.replace(".html", ".url")

        if not os.path.exists(url_path):
            skipped += 1
            continue

        with open(url_path, "r", encoding="utf-8") as f:
            url = f.read().strip()

        # skip already processed
        if url in existing_urls:
            skipped += 1
            continue

        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            html_text = f.read()

        title = get_title_from_html(html_text)
        text  = extract_main_text(html_text)

        if text is None or len(text) < MIN_TEXT_LEN:
            skipped += 1
            continue

        doc = {
            "source": "langchain",
            "url":    url,
            "doc_id": url,
            "title":  title,
            "text":   text
        }

        out.write(json.dumps(doc, ensure_ascii=False) + "\n")
        written += 1

print(f"✅ A3 complete — written: {written}, skipped: {skipped}")
print(f"Output: {output_file}")