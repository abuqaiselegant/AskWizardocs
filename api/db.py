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
                     params={"owner_id": f"eq.{user_id}", "select": "id",
                             "order": "created_at.asc", "limit": "1"})
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


def chat_belongs_to_user(chat_id: str, user_id: str) -> bool:
    """True if chat_id sits in this user's workspace.

    The service-role key bypasses RLS, so every endpoint that takes a chat_id
    from the client must check ownership itself.
    """
    r = requests.get(_url("workspaces"), headers=_h(),
                     params={"owner_id": f"eq.{user_id}", "select": "id",
                             "order": "created_at.asc", "limit": "1"})
    rows = r.json() if r.ok else []
    if not rows:
        return False

    r = requests.get(_url("chats"), headers=_h(),
                     params={"id": f"eq.{chat_id}",
                             "workspace_id": f"eq.{rows[0]['id']}",
                             "select": "id"})
    return bool(r.ok and r.json())


def get_chats(user_id: str) -> list:
    r = requests.get(_url("workspaces"), headers=_h(),
                     params={"owner_id": f"eq.{user_id}", "select": "id",
                             "order": "created_at.asc", "limit": "1"})
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
        {"chat_id": chat_id, "role": "user",      "content": user_content,      "sources_json": None},
        {"chat_id": chat_id, "role": "assistant",  "content": assistant_content, "sources_json": sources},
    ]
    requests.post(_url("messages"), headers=_h(Prefer="return=minimal"), json=rows)


def _current_period() -> str:
    from datetime import date
    today = date.today()
    return today.replace(day=1).isoformat()


FREE_QUERY_LIMIT = 100


def _consume_query(user_id: str) -> int | None:
    """Atomically add 1 to this month's counter, returning the new total.

    None means the RPC is unavailable (migration not applied, or Supabase is
    down) — callers fall back to the read-then-write path.
    """
    r = requests.post(f"{_base()}/rest/v1/rpc/consume_query", headers=_h(),
                      json={"p_user_id": user_id})
    if not r.ok:
        return None
    value = r.json()
    return value if isinstance(value, int) else None


def reserve_query(user_id: str) -> bool:
    """Consume one query from this month's allowance. True = over the limit.

    Counting and checking are a single statement (see consume_query() in
    supabase_schema.sql) so parallel requests cannot each pass a stale check.
    The cost is that the query is spent up front: a request that later fails
    still counts. Paid plans are metered but never blocked.
    """
    r = requests.get(_url("users_profile"), headers=_h(),
                     params={"id": f"eq.{user_id}", "select": "plan"})
    plan = r.json()[0]["plan"] if r.ok and r.json() else "free"

    used = _consume_query(user_id)
    if used is None:
        # No atomic path available — degrade to the racy one rather than
        # dropping the count entirely.
        increment_query_count(user_id)
        used = get_queries_used(user_id)

    if plan != "free":
        return False
    return used > FREE_QUERY_LIMIT


def get_queries_used(user_id: str) -> int:
    r = requests.get(_url("query_usage"), headers=_h(),
                     params={"user_id": f"eq.{user_id}",
                             "period_start": f"eq.{_current_period()}",
                             "select": "count"})
    return r.json()[0]["count"] if r.ok and r.json() else 0


def increment_query_count(user_id: str):
    period = _current_period()
    r = requests.get(_url("query_usage"), headers=_h(),
                     params={"user_id": f"eq.{user_id}",
                             "period_start": f"eq.{period}",
                             "select": "count"})
    if r.ok and r.json():
        current = r.json()[0]["count"]
        requests.patch(_url("query_usage"), headers=_h(Prefer="return=minimal"),
                       params={"user_id": f"eq.{user_id}",
                               "period_start": f"eq.{period}"},
                       json={"count": current + 1})
    else:
        requests.post(_url("query_usage"), headers=_h(Prefer="return=minimal"),
                      json={"user_id": user_id, "count": 1, "period_start": period})


def get_profile(user_id: str) -> dict:
    r = requests.get(_url("users_profile"), headers=_h(),
                     params={"id": f"eq.{user_id}", "select": "name,plan"})
    profile = r.json()[0] if r.ok and r.json() else {"name": None, "plan": "free"}

    r2 = requests.get(_url("workspaces"), headers=_h(),
                      params={"owner_id": f"eq.{user_id}", "select": "id",
                              "order": "created_at.asc", "limit": "1"})
    ws = r2.json()[0]["id"] if r2.ok and r2.json() else None
    chunks = 0
    if ws:
        r3 = requests.get(_url("chunk_usage"), headers=_h(),
                          params={"workspace_id": f"eq.{ws}", "select": "chunks_indexed"})
        chunks = r3.json()[0]["chunks_indexed"] if r3.ok and r3.json() else 0

    queries_used = get_queries_used(user_id)
    return {**profile, "chunks_indexed": chunks, "queries_used": queries_used}


def clear_chats(user_id: str):
    workspace_id = get_or_create_workspace(user_id)
    if not workspace_id:
        return
    requests.delete(_url("chats"), headers=_h(Prefer="return=minimal"),
                    params={"workspace_id": f"eq.{workspace_id}"})


def get_chat_messages(chat_id: str) -> list:
    r = requests.get(_url("messages"), headers=_h(),
                     params={"chat_id": f"eq.{chat_id}",
                             "select": "role,content,sources_json,created_at",
                             "order": "created_at.asc"})
    return r.json() if r.ok else []
