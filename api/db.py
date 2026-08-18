"""
db.py — Supabase REST helpers (service-role, bypasses RLS).
Cap rules: max 10 chats per user; messages kept only for the 2 most recent chats.
"""

import os
from collections import Counter

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


def _first_workspace(user_id: str) -> str | None:
    """This user's workspace id, or None. Same query the older helpers inline."""
    r = requests.get(_url("workspaces"), headers=_h(),
                     params={"owner_id": f"eq.{user_id}", "select": "id",
                             "order": "created_at.asc", "limit": "1"})
    rows = r.json() if r.ok else []
    return rows[0]["id"] if rows else None


def _without_bookmarks(chat_ids: list[str]) -> list[str]:
    """Filter out chats that hold at least one bookmarked message.

    One request for the whole batch. On failure it returns the input unchanged —
    the caller deletes, which is the pre-bookmark behaviour: better to fall back
    to enforcing the cap than to let it stop working silently.
    """
    if not chat_ids:
        return []
    r = requests.get(_url("messages"), headers=_h(),
                     params={"chat_id": f"in.({','.join(chat_ids)})",
                             "bookmarked": "is.true", "select": "chat_id"})
    if not r.ok:
        return chat_ids
    protected = {row["chat_id"] for row in r.json()}
    return [cid for cid in chat_ids if cid not in protected]


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

    # Chat currently at position 2 will fall to position 3 → delete its messages.
    # Bookmarked ones are kept: a saved answer that evaporates once you start two
    # more conversations is not saved, and the profile tab would show a shrinking
    # list nobody deleted.
    if len(chats) >= 2:
        requests.delete(_url("messages"), headers=_h(Prefer="return=minimal"),
                        params={"chat_id": f"eq.{chats[1]['id']}",
                                "bookmarked": "is.false"})

    # Chats at position 10+ will be pushed out → delete (messages cascade).
    # A chat holding a bookmark is skipped for the same reason, so the 10-chat
    # cap is soft for anyone who saves answers. Deliberate: silently destroying
    # saved work is worse than a user sitting slightly over a storage cap.
    if len(chats) >= 10:
        for chat_id in _without_bookmarks([c["id"] for c in chats[9:]]):
            requests.delete(_url("chats"), headers=_h(Prefer="return=minimal"),
                            params={"id": f"eq.{chat_id}"})

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
    """This user's 10 most recent chats, each with its message_count.

    The count exists so the client stops deciding by list position whether a
    chat still has messages. That rule lives here (see create_chat) and used to
    be re-derived in four places in the frontend, none of which would find out
    if it changed. It is also no longer a yes/no question: a capped chat can
    retain only its bookmarked answers, so the messages exist while the thread
    does not.
    """
    workspace_id = _first_workspace(user_id)
    if not workspace_id:
        return []

    r = requests.get(_url("chats"), headers=_h(),
                     params={"workspace_id": f"eq.{workspace_id}",
                             "select": "id,title,created_at",
                             "order": "created_at.desc", "limit": "10"})
    chats = r.json() if r.ok else []
    if not chats:
        return []

    # One request for all ten. If it fails every count is 0, so chats read as
    # title-only: reopening stops working, but nothing appends to a thread the
    # UI cannot show — the safer direction to fail in.
    ids = [c["id"] for c in chats]
    r2 = requests.get(_url("messages"), headers=_h(),
                      params={"chat_id": f"in.({','.join(ids)})", "select": "chat_id"})
    counts = Counter(row["chat_id"] for row in r2.json()) if r2.ok else Counter()

    return [{**c, "message_count": counts.get(c["id"], 0)} for c in chats]


# ── messages ───────────────────────────────────────────────────────────────────

def save_messages(chat_id: str, user_content: str, assistant_content: str, sources: list) -> str | None:
    """Persist the exchange; return the assistant row's id.

    The id is what /ask hands back to the client, and it is the only way to
    bookmark an answer you are looking at — without it the Save button would
    have nothing to address until the chat was reloaded from the database.
    """
    rows = [
        {"chat_id": chat_id, "role": "user",      "content": user_content,      "sources_json": None},
        {"chat_id": chat_id, "role": "assistant",  "content": assistant_content, "sources_json": sources},
    ]
    r = requests.post(_url("messages"), headers=_h(Prefer="return=representation"), json=rows)
    if not (r.ok and isinstance(r.json(), list)):
        return None
    # Match on role rather than trusting insertion order to survive the round trip.
    return next((row["id"] for row in r.json() if row.get("role") == "assistant"), None)


# ── bookmarks (Pro) ────────────────────────────────────────────────────────────

def message_belongs_to_user(message_id: str, user_id: str) -> bool:
    """True if message_id sits in a chat in this user's workspace.

    Same reasoning as chat_belongs_to_user: the service-role key bypasses RLS,
    so ownership is this layer's job. `chats!inner` makes the embedded filter a
    join condition rather than a null-padded left join.
    """
    workspace_id = _first_workspace(user_id)
    if not workspace_id:
        return False
    r = requests.get(_url("messages"), headers=_h(),
                     params={"id": f"eq.{message_id}",
                             "select": "id,chats!inner(workspace_id)",
                             "chats.workspace_id": f"eq.{workspace_id}"})
    return bool(r.ok and r.json())


def set_bookmark(message_id: str, bookmarked: bool, note: str | None) -> bool:
    """Set (not toggle) the bookmark on one message. Call ownership first."""
    payload = {"bookmarked": bookmarked, "bookmark_note": note if bookmarked else None}
    r = requests.patch(_url("messages"), headers=_h(Prefer="return=minimal"),
                       params={"id": f"eq.{message_id}"}, json=payload)
    return r.ok


def get_bookmarks(user_id: str) -> list:
    """Every bookmarked answer for this user, newest first, with its chat title."""
    workspace_id = _first_workspace(user_id)
    if not workspace_id:
        return []
    r = requests.get(_url("messages"), headers=_h(),
                     params={"select": "id,content,sources_json,created_at,bookmark_note,"
                                       "chat_id,chats!inner(title,workspace_id)",
                             "bookmarked": "is.true",
                             "chats.workspace_id": f"eq.{workspace_id}",
                             "order": "created_at.desc", "limit": "100"})
    if not r.ok:
        return []
    return [
        {**{k: v for k, v in row.items() if k != "chats"},
         "chat_title": (row.get("chats") or {}).get("title", "")}
        for row in r.json()
    ]


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


def refund_query(user_id: str) -> int | None:
    """Give one query back. Returns the new total, or None if unavailable.

    Floors at zero in SQL — see refund_query() in supabase_schema.sql.
    """
    r = requests.post(f"{_base()}/rest/v1/rpc/refund_query", headers=_h(),
                      json={"p_user_id": user_id})
    if not r.ok:
        return None
    value = r.json()
    return value if isinstance(value, int) else None


def reserve_query(user_id: str) -> bool:
    """Consume one query from this month's allowance. True = over the limit.

    Counting and checking are a single statement (see consume_query() in
    supabase_schema.sql) so parallel requests cannot each pass a stale check.
    The query is spent up front; /ask refunds it if the pipeline then fails.
    A refusal is refunded here, so a blocked user's counter settles at exactly
    the limit instead of climbing with every rejected attempt. Paid plans are
    metered but never blocked.
    """
    plan = get_plan(user_id)

    used = _consume_query(user_id)
    if used is None:
        # No atomic path available — degrade to the racy one rather than
        # dropping the count entirely.
        increment_query_count(user_id)
        used = get_queries_used(user_id)

    if plan != "free":
        return False

    over = used > FREE_QUERY_LIMIT
    if over:
        # Charging for a request that is about to be refused would make
        # queries_used climb past the limit forever.
        refund_query(user_id)
    return over


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


def get_plan(user_id: str) -> str:
    """'free' | 'pro' | 'team'. Defaults to 'free' if the row or request fails —
    the safe direction: an unreachable Supabase must not hand out Pro features.
    """
    r = requests.get(_url("users_profile"), headers=_h(),
                     params={"id": f"eq.{user_id}", "select": "plan"})
    return r.json()[0]["plan"] if r.ok and r.json() else "free"


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
                             "select": "id,role,content,sources_json,created_at,"
                                       "bookmarked,bookmark_note",
                             "order": "created_at.asc"})
    return r.json() if r.ok else []
