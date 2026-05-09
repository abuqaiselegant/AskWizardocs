import requests
import xml.etree.ElementTree as ET

sitemap_url = "https://docs.langchain.com/sitemap.xml"


LIMIT = None
# Download sitemap
response = requests.get(sitemap_url)
# response.raise_for_status()

xml_text = response.text

# Parse XML
root = ET.fromstring(xml_text)

# Namespace for sitemap
ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# i can also do like this for automatically getting the namespace:
# namespace = root.tag.split('}')[0].strip('{'})
# ns = {"sm": namespace}

urls = []

for url_block in root.findall("sm:url", ns):
    loc = url_block.find("sm:loc", ns)
    if loc is not None and loc.text:
        urls.append(loc.text.strip())

# Remove duplicates
urls = sorted(set(urls))

if LIMIT is not None:
    urls = urls[:LIMIT]

# Save URLs
out_path = "rag-dataset/data/sources/langchain_urls.txt"
with open(out_path, "w", encoding="utf-8") as f:
    for url in urls:
        f.write(url + "\n")
print(f"Done! Saved {len(urls)} URLs -> {out_path}")



## here i have first scrapped all the xml text,(it has namespace style, which will be used for parsing)
## now we will store all the urls, which are inside the loc nested under url, stripping the whitespace around it, in array
## this urls then write in file as a new line.
## we have to take or duplicate urls(using set)
## output path 