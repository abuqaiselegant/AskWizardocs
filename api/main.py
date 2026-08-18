"""
main.py — FastAPI app for AskMyDocs.

Endpoints:
    POST /ask                        — full RAG pipeline: answer + cited sources
    POST /ask/stream                 — same pipeline, server-sent events
    POST /chats, GET /chats,
    DELETE /chats                    — conversation list (cap: 10)
    GET  /chats/{id}/messages        — stored turns for one chat
    POST /messages/{id}/bookmark     — save an answer (Pro)
    GET  /bookmarks                  — saved answers, newest first
    GET  /profile                    — name, plan, usage
    GET  /health                     — liveness check

API only — the frontend is a separate Vite build deployed to Vercel.
"""

from dotenv import load_dotenv
load_dotenv()

import json
import logging
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from api.auth import get_current_user
from api import db
from src.generation.generator import ask, ask_stream

log = logging.getLogger(__name__)

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

class BookmarkRequest(BaseModel):
    bookmarked: bool
    note:       str | None = Field(default=None, max_length=500)


class Source(BaseModel):
    number:  int
    title:   str
    url:     str
    source:  str = ""                # corpus slug: langchain | huggingface | chromadb
    score:   float | None = None     # Cohere relevance; None when rerank fell back to RRF
    snippet: str = ""                # first ~240 chars of the cited chunk


class AskResponse(BaseModel):
    answer:     str
    sources:    list[Source]
    # Cohere score of the top chunk; None when the rerank fell back to RRF order
    # and there is no real score — the UI hides the meter rather than guessing.
    confidence: float | None = None
    followups:  list[str] = []
    # Id of the stored assistant message, so the client can bookmark the answer
    # it is looking at. None when there was no chat_id, or the save failed.
    message_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/ask", response_model=AskResponse)
def ask_endpoint(request: AskRequest, user_id: str = Depends(get_current_user)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    # Ownership, plan and quota in one round trip (begin_ask in the schema).
    # Ownership is still settled before the quota is spent and before any paid
    # API call — that ordering lives inside the function now.
    gate = db.start_ask(user_id, request.chat_id)
    if gate == "not_found":
        raise HTTPException(status_code=404, detail="Chat not found")
    if gate == "over_limit":
        raise HTTPException(status_code=402, detail="Monthly query limit reached. Upgrade to Pro.")
    history = [{"role": t.role, "content": t.content} for t in request.history]
    try:
        result = ask(request.question, history, source=request.source)
    except Exception:
        # The quota is spent before the pipeline runs, so a failure here would
        # otherwise cost the user one of their 100 for an answer they never got.
        # Note this is narrower than it looks: the reranker already fails safe,
        # so a Cohere outage degrades rather than raises. What lands here is the
        # OpenAI side (rate limit, quota, timeout), the embedding call and Chroma.
        db.refund_query(user_id)
        log.warning("ask() failed; refunded query for %s", user_id, exc_info=True)
        raise HTTPException(status_code=503,
                            detail="Answer generation failed — your query was not counted.")
    if request.chat_id:
        try:
            result["message_id"] = db.save_messages(
                request.chat_id, request.question, result["answer"], result["sources"])
        except Exception:
            # The answer is already paid for and still worth returning, so this
            # stays non-fatal — but it used to be a bare `pass`, which meant a
            # chat could silently stop persisting with nothing in the log to
            # explain it. exc_info so the Supabase error is recoverable.
            log.warning("save_messages failed for chat %s", request.chat_id, exc_info=True)
    return result


def _sse(event: str, payload) -> str:
    """One server-sent event frame.

    The payload is JSON-encoded rather than written raw because answer text
    contains newlines, and a newline inside a `data:` line ends the frame.
    """
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


@app.post("/ask/stream")
def ask_stream_endpoint(request: AskRequest, user_id: str = Depends(get_current_user)):
    """Same pipeline as /ask, delivered as it is produced.

    /ask stays exactly as it was. Two endpoints rather than a flag on one,
    because the failure semantics genuinely differ — see below — and because a
    client that cannot read a stream should not have to know that.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")
    # Gating happens out here, before the response begins. Once the first byte
    # of a streaming body is on the wire the status line is already sent, so a
    # 402 or 404 decided inside the generator could not be expressed as one.
    gate = db.start_ask(user_id, request.chat_id)
    if gate == "not_found":
        raise HTTPException(status_code=404, detail="Chat not found")
    if gate == "over_limit":
        raise HTTPException(status_code=402, detail="Monthly query limit reached. Upgrade to Pro.")

    history = [{"role": t.role, "content": t.content} for t in request.history]

    def events():
        delivered = False        # has any answer text reached the client?
        try:
            for event, payload in ask_stream(request.question, history, source=request.source):
                if event == "delta":
                    delivered = True
                    yield _sse("delta", payload)
                elif event == "meta":
                    yield _sse("meta", payload)
                elif event == "done":
                    message_id = None
                    if request.chat_id:
                        try:
                            message_id = db.save_messages(
                                request.chat_id, request.question,
                                payload["answer"], payload["sources"])
                        except Exception:
                            log.warning("save_messages failed for chat %s",
                                        request.chat_id, exc_info=True)
                    yield _sse("done", {"sources":    payload["sources"],
                                        "followups":  payload["followups"],
                                        "message_id": message_id})
        except Exception:
            # Refund only when nothing was delivered. /ask refunds on any
            # failure because a failure there means an empty response, but here
            # a client that disconnects mid-answer also lands in this handler —
            # refunding that would hand out free queries to anyone who closes
            # the tab, and the OpenAI tokens were spent either way.
            if not delivered:
                db.refund_query(user_id)
            log.warning("ask_stream failed for %s (delivered=%s)", user_id, delivered,
                        exc_info=True)
            yield _sse("error", {
                "detail": "Answer generation failed." + ("" if delivered
                          else " Your query was not counted."),
            })

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # no-cache stops a proxy replaying yesterday's answer; X-Accel-Buffering
        # is nginx's opt-out, harmless elsewhere and cheap insurance since a
        # buffering hop turns this back into /ask without any visible error.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


@app.post("/messages/{message_id}/bookmark")
def bookmark_message(message_id: str, body: BookmarkRequest,
                     user_id: str = Depends(get_current_user)):
    # Plan first: a free user must not learn whether a message id exists.
    if db.get_plan(user_id) == "free":
        raise HTTPException(status_code=402, detail="Saving answers is a Pro feature.")
    if not db.message_belongs_to_user(message_id, user_id):
        raise HTTPException(status_code=404, detail="Message not found")
    if not db.set_bookmark(message_id, body.bookmarked, body.note):
        raise HTTPException(status_code=500, detail="Failed to update bookmark")
    return {"bookmarked": body.bookmarked}


@app.get("/bookmarks")
def list_bookmarks(user_id: str = Depends(get_current_user)):
    # Not plan-gated: a user who was Pro and lapsed must still be able to read
    # what they saved. Only creating a new bookmark costs a plan.
    return db.get_bookmarks(user_id)


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
