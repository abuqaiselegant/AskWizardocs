"""
02 — Download each URL to disk.

Step 2 of the LangChain HTML pipeline. Reads the URL list from 01 and saves each
page as page_N.html alongside a page_N.url recording where it came from, since
the filename cannot.

Resumable: a page whose .html already exists is skipped, so an interrupted run
can simply be restarted rather than re-fetching 700+ pages.
"""

import requests
import time
import os

# File containing URLs
url_file = "rag-dataset/data/sources/langchain_urls.txt"

# Folder where HTML pages will be saved
output_folder = "rag-dataset/data/raw/langchain_html"

# How many pages to download
LIMIT = None   # set to 20 for testing

# Read URLs
with open(url_file, "r") as f:
    urls = [line.strip() for line in f.readlines()]

# Apply limit if needed
if LIMIT is not None:
    urls = urls[:LIMIT]

print(f"Downloading {len(urls)} pages...\n")

for i, url in enumerate(urls):

    html_file = f"{output_folder}/page_{i+1}.html"
    url_file_path = f"{output_folder}/page_{i+1}.url"

    # Skip if already downloaded (resume capability)
    if os.path.exists(html_file):
        print(f"Skipping page {i+1}, already downloaded")
        continue

    print(f"Downloading page {i+1}: {url}")

    try:
        response = requests.get(url, timeout=30)

        # Save HTML
        with open(html_file, "w", encoding="utf-8") as f:
            f.write(response.text)

        # Save the URL (important for citations later)
        with open(url_file_path, "w", encoding="utf-8") as f:
            f.write(url)

        time.sleep(0.5)

    except Exception as e:
        print(f"Error downloading {url}")
        print(e)

print("\nDownload complete!")