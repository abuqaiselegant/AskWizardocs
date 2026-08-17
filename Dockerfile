FROM python:3.12-slim

WORKDIR /app

# Deps first — cached unless requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime data (minimal): vector store + BM25 corpus only.
# Placed before code so editing code doesn't bust this ~260 MB layer.
COPY chroma_db/ ./chroma_db/
COPY rag-dataset/data/processed/chunks.jsonl ./rag-dataset/data/processed/chunks.jsonl

# Application code (changes most often).
COPY src/ ./src/
COPY api/ ./api/

# Unbuffer stdout. bm25_retriever.py and reranker.py announce their mode with
# bare print(); Python block-buffers stdout when it isn't a TTY, and the buffer
# never fills in a long-lived server, so those banners never reached
# `docker compose logs` — which is exactly what AWS_RUNBOOK.md's monthly
# "which retrieval mode did the API boot in?" check greps for.
#
# Declared here rather than at the top on purpose: ENV applies at runtime
# regardless of position, but putting it above the pip layer would invalidate
# the ~96-package install on every rebuild for no benefit.
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
