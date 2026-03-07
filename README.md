# AskMyDocs

RAG (Retrieval-Augmented Generation) system to ingest docs, embed chunks, and answer questions over your documents.

## Setup

```bash
pip install -r requirements.txt
```
Create `.env` with `OPENAI_API_KEY=...` for embeddings.

## Usage

1. **Ingest docs** — `rag-dataset/scripts/` (sitemap → URLs → download pages → chunks)
2. **Embed & store** — Run `src/ingestion/embedder.py` to embed chunks into ChromaDB
3. **Query** — Use retrieval + LLM (see `PLAN.md` for full pipeline)

## Stack

- ChromaDB (vector store), OpenAI (embeddings), Trafilatura/BeautifulSoup (scraping)
