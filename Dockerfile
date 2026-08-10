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

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
