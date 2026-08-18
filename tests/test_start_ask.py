"""
test_start_ask.py — the /ask gate: ownership, plan, quota.

start_ask() is where a regression is expensive rather than merely wrong. Get it
too permissive and every caller gets unmetered answers on someone else's OpenAI
bill; too strict and paying users are refused. Neither shows up as an exception.

Offline, like the rest of the suite: `requests` and `dotenv` are stood in for at
import, so no Supabase call is made and CI still installs nothing but pytest.

Run:  pytest tests/ -q
"""

import sys
import types

import pytest


def _stub(name: str, **members) -> types.ModuleType:
    mod = types.ModuleType(name)
    for key, value in members.items():
        setattr(mod, key, value)
    sys.modules[name] = mod
    return mod


# api/db.py reaches for both of these at import time.
_stub("dotenv", load_dotenv=lambda *a, **k: None)
_stub("requests", post=None, get=None, patch=None, delete=None)

from api import db  # noqa: E402

LIMIT = db.FREE_QUERY_LIMIT


class Resp:
    """The two attributes db.py actually reads off a response."""

    def __init__(self, payload, ok=True):
        self.ok = ok
        self._payload = payload

    def json(self):
        return self._payload


@pytest.fixture
def rpc(monkeypatch):
    """Route begin_ask / refund_query to canned replies and record the calls.

    Both go through requests.post, so they are told apart by URL — which also
    means a test can assert that a refund did *not* happen.
    """
    calls = []

    def configure(begin=None, begin_ok=True):
        def fake_post(url, headers=None, json=None, **kw):
            calls.append((url.rsplit("/", 1)[-1], json))
            if url.endswith("/begin_ask"):
                return Resp(begin, ok=begin_ok)
            if url.endswith("/refund_query"):
                return Resp(0)
            raise AssertionError(f"unexpected POST to {url}")

        monkeypatch.setattr(db.requests, "post", fake_post)
        return calls

    configure.calls = calls
    return configure


def row(owns_chat=True, plan="free", queries_used=1):
    return [{"owns_chat": owns_chat, "plan": plan, "queries_used": queries_used}]


def refunds(calls):
    return [c for c in calls if c[0] == "refund_query"]


# ── the happy path ────────────────────────────────────────────────────────────

def test_none_means_proceed(rpc):
    rpc(begin=row(queries_used=1))
    assert db.start_ask("u", "c") is None


def test_the_rpc_is_given_the_user_and_the_chat(rpc):
    calls = rpc(begin=row())
    db.start_ask("user-1", "chat-1")
    assert calls[0] == ("begin_ask", {"p_user_id": "user-1", "p_chat_id": "chat-1"})


def test_a_chatless_ask_still_passes_a_null_chat_id(rpc):
    calls = rpc(begin=row())
    assert db.start_ask("user-1", None) is None
    assert calls[0][1]["p_chat_id"] is None


# ── ownership ─────────────────────────────────────────────────────────────────

def test_someone_elses_chat_is_not_found(rpc):
    rpc(begin=row(owns_chat=False))
    assert db.start_ask("u", "c") == "not_found"


def test_a_rejected_chat_is_never_refunded(rpc):
    # begin_ask() returns before the counter moves when ownership fails, so a
    # refund here would hand back a query that was never spent.
    calls = rpc(begin=row(owns_chat=False, queries_used=5))
    db.start_ask("u", "c")
    assert refunds(calls) == []


# ── the free-tier limit ───────────────────────────────────────────────────────

def test_exactly_at_the_limit_still_proceeds(rpc):
    # The 100th query is the last allowed one, not the first refused one.
    rpc(begin=row(queries_used=LIMIT))
    assert db.start_ask("u", "c") is None


def test_one_past_the_limit_is_refused(rpc):
    rpc(begin=row(queries_used=LIMIT + 1))
    assert db.start_ask("u", "c") == "over_limit"


def test_a_refusal_is_refunded_exactly_once(rpc):
    # Without this the counter climbs on every rejected attempt and the user is
    # driven further past a limit they can no longer reach the other side of.
    calls = rpc(begin=row(queries_used=LIMIT + 1))
    db.start_ask("u", "c")
    assert refunds(calls) == [("refund_query", {"p_user_id": "u"})]


@pytest.mark.parametrize("plan", ["pro", "team"])
def test_paid_plans_are_metered_but_never_blocked(rpc, plan):
    calls = rpc(begin=row(plan=plan, queries_used=LIMIT * 10))
    assert db.start_ask("u", "c") is None
    assert refunds(calls) == []


# ── the RPC itself being unavailable ──────────────────────────────────────────

def test_an_erroring_rpc_is_unavailable_not_permission_to_proceed(rpc):
    # The dangerous failure: None means "go ahead", so an outage must not be
    # able to produce it.
    rpc(begin=None, begin_ok=False)
    assert db.start_ask("u", "c") == "unavailable"


def test_an_empty_result_set_is_unavailable(rpc):
    rpc(begin=[])
    assert db.start_ask("u", "c") == "unavailable"


def test_a_non_list_payload_is_unavailable(rpc):
    rpc(begin={"owns_chat": True, "plan": "free", "queries_used": 1})
    assert db.start_ask("u", "c") == "unavailable"


def test_nothing_is_refunded_when_nothing_was_consumed(rpc):
    calls = rpc(begin=None, begin_ok=False)
    db.start_ask("u", "c")
    assert refunds(calls) == []
