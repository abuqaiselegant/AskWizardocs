"""
main.py — FastAPI app for AskMyDocs.

Endpoints:
    POST /ask     — run the full RAG pipeline, return answer + cited sources
    GET  /health  — liveness check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.generation.generator import ask

app = FastAPI(title="AskMyDocs", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str


class Source(BaseModel):
    number: int
    title:  str
    url:    str


class AskResponse(BaseModel):
    answer:  str
    sources: list[Source]


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/ask", response_model=AskResponse)
def ask_endpoint(request: AskRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    result = ask(request.question)
    return result


@app.get("/health")
def health():
    return {"status": "ok"}
