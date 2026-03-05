import os
import json
import trafilatura
from bs4 import BeautifulSoup

# Input folder containing downloaded HTML + URL files
input_folder = "data/raw/langchain_html"

# Output JSONL file
output_file = "data/processed/docs.jsonl"

# Create output folder if it doesn't exist
os.makedirs("data/processed", exist_ok=True)

MIN_TEXT_LEN = 300  # skip pages that extract too little content

def get_title_from_html(html_text):
    """Extract the <title> tag from HTML (useful metadata)."""
    soup = BeautifulSoup(html_text, "lxml")
    if soup.title and soup.title.text:
        return soup.title.text.strip()
    return ""

def extract_main_text(html_text):
    """
    Extract main readable content from HTML.
    Trafilatura tries to remove nav/menu/footer automatically.
    """
    return trafilatura.extract(html_text)

# Collect all downloaded .html files
html_files = [f for f in os.listdir(input_folder) if f.endswith(".html")]
html_files.sort()

written = 0
skipped = 0
skipped_urls = []

with open(output_file, "w", encoding="utf-8") as out:
    for html_name in html_files:
        html_path = os.path.join(input_folder, html_name)
        url_path = html_path.replace(".html", ".url")

        # Skip if matching .url file is missing
        if not os.path.exists(url_path):
            skipped += 1
            skipped_urls.append(f"(missing .url file) {html_name}")
            continue

        # Read URL
        with open(url_path, "r", encoding="utf-8") as f:
            url = f.read().strip()

        # Read HTML
        with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
            html_text = f.read()

        # Extract metadata + main text
        title = get_title_from_html(html_text)
        text = extract_main_text(html_text)

        # Skip if extraction failed / too short
        if text is None or len(text) < MIN_TEXT_LEN:
            skipped += 1
            skipped_urls.append(url)
            continue

        doc = {
            "source": "langchain",
            "url": url,
            "doc_id": url,       # doc_id = url (traceable)
            "title": title,
            "text": text
        }

        out.write(json.dumps(doc, ensure_ascii=False) + "\n")
        written += 1

print("✅ A3 complete")
print("HTML files found:", len(html_files))
print("Docs written:", written)
print("Skipped:", skipped)
print("Output:", output_file)

# print("\nSkipped URLs/files:")
# for u in skipped_urls:
#     print("-", u)