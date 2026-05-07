"""
db.py — Supabase REST helpers (service-role, bypasses RLS).
Cap rules: max 10 chats per user; messages kept only for the 2 most recent chats.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()


def _base():
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _key():
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _h(**extra):
    k = _key()
    return {
        "apikey": k,
        "Authorization": f"Bearer {k}",
        "Content-Type": "application/json",
        **extra,
    }


def _url(table):
    return f"{_base()}/rest/v1/{table}"


# ── workspace ──────────────────────────────────────────────────────────────────

def get_or_create_workspace(user_id: str) -> str | None:
    r = requests.get(_url("workspaces"), headers=_h(),
                     params={"owner_id": f"eq.{user_id}", "select": "id", "limit": "1"})
    rows = r.json() if r.ok else []
    if rows:
        return rows[0]["id"]

    # Ensure profile row exists (trigger may not have run for early sign-ups)
    requests.post(_url("users_profile"), headers=_h(Prefer="resolution=ignore-duplicates,return=minimal"),
                  json={"id": user_id})

    r = requests.post(_url("workspaces"), headers=_h(Prefer="return=representation"),
                      json={"owner_id": user_id, "name": "My workspace"})
    if not (r.ok and r.json()):
        return None
    ws_id = r.json()[0]["id"]
    requests.post(_url("chunk_usage"), headers=_h(Prefer="resolution=ignore-duplicates,return=minimal"),
                  json={"workspace_id": ws_id})
    return ws_id


# ── chats ──────────────────────────────────────────────────────────────────────

def create_chat(user_id: str, title: str) -> str | None:
    workspace_id = get_or_create_workspace(user_id)
    if not workspace_id:
        return None

    # Existing chats, newest-first
    r = requests.get(_url("chats"), headers=_h(),
                     params={"workspace_id": f"eq.{workspace_id}",
                             "select": "id", "order": "created_at.desc"})
    chats = r.json() if r.ok else []

    # Chat currently at position 2 will fall to position 3 → delete its messages
    if len(chats) >= 2:
        requests.delete(_url("messages"), headers=_h(Prefer="return=minimal"),
                        params={"chat_id": f"eq.{chats[1]['id']}"})

    # Chats at position 10+ will be pushed out → delete (messages cascade)
    if len(chats) >= 10:
        for chat in chats[9:]:
            requests.delete(_url("chats"), headers=_h(Prefer="return=minimal"),
                            params={"id": f"eq.{chat['id']}"})

    r = requests.post(_url("chats"), headers=_h(Prefer="return=representation"),
                      json={"workspace_id": workspace_id, "title": title[:80]})
    if r.ok and r.json():
        return r.json()[0]["id"]
    return None


def get_chats(user_id: str) -> list:
    r = requests.get(_url("workspaces"), headers=_h(),
                     params={"owner_id": f"eq.{user_id}", "select": "id", "limit": "1"})
    rows = r.json() if r.ok else []
    if not rows:
        return []

    r = requests.get(_url("chats"), headers=_h(),
                     params={"workspace_id": f"eq.{rows[0]['id']}",
                             "select": "id,title,created_at",
                             "order": "created_at.desc", "limit": "10"})
    return r.json() if r.ok else []


# ── messages ───────────────────────────────────────────────────────────────────

def save_messages(chat_id: str, user_content: str, assistant_content: str, sources: list):
    rows = [
        {"chat_id": chat_id, "role": "user",      "content": user_content},
        {"chat_id": chat_id, "role": "assistant",  "content": assistant_content, "sources_json": sources},
    ]
    requests.post(_url("messages"), headers=_h(Prefer="return=minimal"), json=rows)


def get_chat_messages(chat_id: str) -> list:
    r = requests.get(_url("messages"), headers=_h(),
                     params={"chat_id": f"eq.{chat_id}",
                             "select": "role,content,sources_json,created_at",
                             "order": "created_at.asc"})
    return r.json() if r.ok else []
