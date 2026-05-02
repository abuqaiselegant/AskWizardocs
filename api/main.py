"""
main.py — FastAPI app for AskMyDocs.

Endpoints:
    POST /ask     — run the full RAG pipeline, return answer + cited sources
    GET  /health  — liveness check
    GET  /        — serves the Wizardocs frontend (frontend/index.html)
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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


# ── Frontend ───────────────────────────────────────────────────────────────────
# Serve the static Wizardocs UI. Any path that is a real file under frontend/ is
# returned as-is (handles src/chat.jsx etc.); everything else falls back to index.html.
_FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.isdir(_FRONTEND):
    @app.get("/", include_in_schema=False)
    def serve_frontend():
        return FileResponse(os.path.join(_FRONTEND, "index.html"))

    @app.get("/{path:path}", include_in_schema=False)
    def serve_frontend_assets(path: str):
        target = os.path.join(_FRONTEND, path)
        if os.path.isfile(target):
            return FileResponse(target)
        return FileResponse(os.path.join(_FRONTEND, "index.html"))
