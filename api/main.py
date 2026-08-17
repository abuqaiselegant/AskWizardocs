"""
main.py — FastAPI app for AskMyDocs.

Endpoints:
    POST /ask     — run the full RAG pipeline, return answer + cited sources
    GET  /health  — liveness check

API only — the frontend is a separate Vite build deployed to Vercel.
"""

from dotenv import load_dotenv
load_dotenv()

from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.auth import get_current_user
from api import db
from src.generation.generator import ask

app = FastAPI(title="AskMyDocs", version="1.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["https://ask-wizardocs.vercel.app", "http://localhost:5173"],
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
# Bounds keep one request from becoming an unbounded OpenAI bill, and stop a
# client smuggling a "system" turn past the citation-only prompt. The frontend
# sends at most 6 turns (chat.jsx: messages.slice(-6)).
class Turn(BaseModel):
    role:    Literal["user", "assistant"]
    content: str = Field(max_length=8000)

class AskRequest(BaseModel):
    question: str = Field(max_length=2000)
    chat_id:  str | None = None
    history:  list[Turn] = Field(default=[], max_length=6)
    source:   str | None = None

class CreateChatRequest(BaseModel):
    title: str = Field(max_length=200)


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
    # Checked before the quota is spent and before any paid API call.
    if request.chat_id and not db.chat_belongs_to_user(request.chat_id, user_id):
        raise HTTPException(status_code=404, detail="Chat not found")
    if db.reserve_query(user_id):
        raise HTTPException(status_code=402, detail="Monthly query limit reached. Upgrade to Pro.")
    history = [{"role": t.role, "content": t.content} for t in request.history]
    result = ask(request.question, history, source=request.source)
    if request.chat_id:
        try:
            db.save_messages(request.chat_id, request.question, result["answer"], result["sources"])
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
    # 404 rather than 403 — don't confirm that someone else's chat_id exists.
    if not db.chat_belongs_to_user(chat_id, user_id):
        raise HTTPException(status_code=404, detail="Chat not found")
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
