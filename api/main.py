"""
main.py — FastAPI app for AskMyDocs.

Endpoints:
    POST /ask     — run the full RAG pipeline, return answer + cited sources
    GET  /health  — liveness check
    GET  /        — serves the Wizardocs frontend (frontend/index.html)
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from api.auth import get_current_user
from api import db
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
class Turn(BaseModel):
    role: str
    content: str

class AskRequest(BaseModel):
    question: str
    chat_id:  str | None = None
    history:  list[Turn] = []

class CreateChatRequest(BaseModel):
    title: str


class Source(BaseModel):
    number: int
    title:  str
    url:    str


class AskResponse(BaseModel):
    answer:     str
    sources:    list[Source]
    confidence: float = 0.78
    followups:  list[str] = []


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/ask", response_model=AskResponse)
def ask_endpoint(request: AskRequest, user_id: str = Depends(get_current_user)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    if db.check_quota(user_id):
        raise HTTPException(status_code=402, detail="Monthly query limit reached. Upgrade to Pro.")
    history = [{"role": t.role, "content": t.content} for t in request.history]
    result = ask(request.question, history)
    if request.chat_id:
        try:
            db.save_messages(request.chat_id, request.question, result["answer"], result["sources"])
        except Exception:
            pass
    try:
        db.increment_query_count(user_id)
    except Exception:
        pass
    return result


@app.post("/chats")
def create_chat(body: CreateChatRequest, user_id: str = Depends(get_current_user)):
    chat_id = db.create_chat(user_id, body.title)
    if not chat_id:
        raise HTTPException(status_code=500, detail="Failed to create chat")
    return {"chat_id": chat_id}


@app.get("/chats")
def list_chats(user_id: str = Depends(get_current_user)):
    return db.get_chats(user_id)


@app.get("/chats/{chat_id}/messages")
def get_messages(chat_id: str, user_id: str = Depends(get_current_user)):
    return db.get_chat_messages(chat_id)


@app.get("/profile")
def get_profile(user_id: str = Depends(get_current_user)):
    return db.get_profile(user_id)


@app.delete("/chats")
def delete_chats(user_id: str = Depends(get_current_user)):
    db.clear_chats(user_id)
    return {"ok": True}


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
