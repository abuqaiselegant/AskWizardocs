"""
test_db_layer.py — api/db.py, the Supabase layer under every endpoint.

db.py is request-shaping on the way out and response-parsing on the way back,
and both halves fail quietly. A dropped filter still returns 200, just with
somebody else's rows in it. A response shape the parser doesn't recognise turns
into "you have no chats" rather than an error. Neither raises, so neither shows
up anywhere except in what the user sees.

The parts worth being strict about, and why:
    ownership   chat_belongs_to_user / message_belongs_to_user are the only
                thing standing between a guessed id and another user's data —
                the service-role key bypasses RLS, so Postgres will not say no.
    fail-safe   get_plan defaults to 'free'. An unreachable Supabase must not
                hand out Pro features (api/main.py gates bookmarks on it).
    parsing     get_chats, get_bookmarks and save_messages reshape PostgREST
                payloads; a mis-read key is an empty list, not a 500.

start_ask() has its own file (test_start_ask.py). This covers the rest.

Offline, like the rest of the suite: `requests` and `dotenv` are stood in for
before api.db is imported, so nothing here touches the network and CI still
installs nothing but pytest.

Out of scope on purpose: api/main.py needs fastapi, which the CI job does not
install — see .github/workflows/tests.yml for why that is deliberate.

Run:  pytest tests/ -q
"""

import sys
import types

import pytest


def _stub(name: str, **members) -> types.ModuleType:
    """Same helper as test_start_ask.py, kept local rather than shared.

    Whichever of the two files pytest imports first does the stubbing; the
    other's `from api import db` then gets the cached module either way, and
    both fixtures reach for `db.requests` rather than sys.modules, so the order
    they run in does not matter.
    """
    mod = types.ModuleType(name)
    for key, value in members.items():
        setattr(mod, key, value)
    sys.modules[name] = mod
    return mod


def _unstubbed(*a, **k):
    # Loud, not silent: a test that forgot the `http` fixture should fail here
    # rather than attempt a real request to Supabase.
    raise AssertionError("db.py made an unstubbed HTTP call — is the `http` fixture missing?")


_stub("dotenv", load_dotenv=lambda *a, **k: None)
_stub("requests", get=_unstubbed, post=_unstubbed, patch=_unstubbed, delete=_unstubbed)

from api import db  # noqa: E402


# ── The fake Supabase ─────────────────────────────────────────────────────────

class Resp:
    """The two attributes db.py reads off a response: .ok and .json()."""

    def __init__(self, payload, ok=True):
        self.ok = ok
        self._payload = payload

    def json(self):
        return self._payload


class Call:
    """One request db.py made, in the terms the assertions care about."""

    def __init__(self, method, url, headers, params, json):
        self.method  = method
        self.url     = url
        self.table   = url.split("/rest/v1/", 1)[-1]   # "chats" | "rpc/create_chat"
        self.headers = headers or {}
        self.params  = params or {}
        self.json    = json

    def __repr__(self):
        return f"<{self.method} {self.table} params={self.params} json={self.json}>"


class FakeSupabase:
    """Records what db.py sends and replies with what a test queued.

    A table with nothing queued gets an empty 200 — which is exactly what
    PostgREST returns for a filter that matched nothing, and therefore the right
    default for "this user has no rows yet".
    """

    def __init__(self):
        self.calls = []
        self._queued = {}

    def reply(self, table, payload=None, ok=True):
        self._queued.setdefault(table, []).append(Resp([] if payload is None else payload, ok))
        return self

    def _recorder(self, method):
        def call(url, headers=None, params=None, json=None, **kw):
            recorded = Call(method, url, headers, params, json)
            self.calls.append(recorded)
            queue = self._queued.get(recorded.table)
            return queue.pop(0) if queue else Resp([])
        return call

    def of(self, table):
        return [c for c in self.calls if c.table == table]

    @property
    def trace(self):
        """[(verb, table), ...] — the whole conversation, in order."""
        return [(c.method, c.table) for c in self.calls]


@pytest.fixture
def http(monkeypatch):
    fake = FakeSupabase()
    for verb in ("get", "post", "patch", "delete"):
        monkeypatch.setattr(db.requests, verb, fake._recorder(verb.upper()))
    return fake


@pytest.fixture(autouse=True)
def credentials(monkeypatch):
    # Trailing slash on purpose: _base() strips it, and a doubled slash in the
    # path is a 404 from PostgREST.
    monkeypatch.setenv("SUPABASE_URL", "https://project.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")


WS = [{"id": "ws-1"}]          # the one-row reply a workspace lookup returns


# ── URLs and headers ──────────────────────────────────────────────────────────
# Every call in the module is built from these three. Get them wrong and the
# whole layer returns 401 or 404 — noisy, but only in production.

def test_base_url_drops_the_trailing_slash():
    assert db._base() == "https://project.supabase.co"


def test_table_urls_go_through_the_rest_path():
    assert db._url("chats") == "https://project.supabase.co/rest/v1/chats"


def test_headers_send_the_service_role_key_as_both_apikey_and_bearer():
    # PostgREST wants the apikey header; PostgREST's auth wants the bearer.
    # Sending only one of them authenticates as anon, which RLS then filters to
    # nothing — an empty list, not an error.
    h = db._h()
    assert h["apikey"] == "service-role-key"
    assert h["Authorization"] == "Bearer service-role-key"
    assert h["Content-Type"] == "application/json"


def test_extra_headers_are_merged_not_replaced():
    h = db._h(Prefer="return=representation")
    assert h["Prefer"] == "return=representation"
    assert h["apikey"] == "service-role-key"


def test_every_request_carries_the_key(http):
    # One assertion for the whole layer: no helper builds headers by hand.
    http.reply("users_profile", [{"name": "A", "plan": "pro"}])
    http.reply("workspaces", WS)
    db.get_profile("u")
    assert http.calls
    assert all(c.headers.get("apikey") == "service-role-key" for c in http.calls)


# ── get_or_create_workspace ───────────────────────────────────────────────────

def test_an_existing_workspace_is_returned_without_creating_another(http):
    http.reply("workspaces", WS)
    assert db.get_or_create_workspace("u") == "ws-1"
    assert http.trace == [("GET", "workspaces")]


def test_the_workspace_lookup_is_pinned_to_the_oldest_row(http):
    # Every helper that resolves a workspace uses this same query. If one of
    # them ordered differently, a user with two workspaces would see their
    # bookmarks and their chats disagree about which one is theirs.
    http.reply("workspaces", WS)
    db.get_or_create_workspace("user-7")
    assert http.of("workspaces")[0].params == {
        "owner_id": "eq.user-7", "select": "id", "order": "created_at.asc", "limit": "1",
    }


def test_a_first_time_user_gets_a_profile_a_workspace_and_a_usage_row(http):
    http.reply("workspaces", [])                          # GET: none yet
    http.reply("users_profile", [])                       # POST: upsert
    http.reply("workspaces", [{"id": "ws-new"}])          # POST: created
    assert db.get_or_create_workspace("u") == "ws-new"
    assert http.trace == [
        ("GET", "workspaces"), ("POST", "users_profile"),
        ("POST", "workspaces"), ("POST", "chunk_usage"),
    ]


def test_the_profile_insert_tolerates_a_row_the_trigger_already_made(http):
    # Without ignore-duplicates this is a 409 on every user the signup trigger
    # did reach, which would take the workspace down with it.
    http.reply("workspaces", [])
    http.reply("workspaces", [{"id": "ws-new"}])
    db.get_or_create_workspace("u")
    prefer = http.of("users_profile")[0].headers["Prefer"]
    assert "resolution=ignore-duplicates" in prefer


def test_the_usage_row_is_seeded_against_the_new_workspace(http):
    http.reply("workspaces", [])
    http.reply("workspaces", [{"id": "ws-new"}])
    db.get_or_create_workspace("u")
    assert http.of("chunk_usage")[0].json == {"workspace_id": "ws-new"}


def test_a_failed_workspace_insert_returns_none_and_seeds_nothing(http):
    http.reply("workspaces", [])
    http.reply("workspaces", None, ok=False)
    assert db.get_or_create_workspace("u") is None
    assert http.of("chunk_usage") == []


def test_an_insert_that_returns_no_row_is_also_none(http):
    # Prefer: return=representation and an empty body means the row is not
    # there to use, whatever the status code said.
    http.reply("workspaces", [])
    http.reply("workspaces", [])
    assert db.get_or_create_workspace("u") is None


def test_first_workspace_reads_without_creating(http):
    # The read-only twin: the bookmark helpers must not conjure a workspace for
    # a user who has none, or they would answer for the wrong one.
    assert db._first_workspace("u") is None
    assert http.trace == [("GET", "workspaces")]


# ── create_chat ───────────────────────────────────────────────────────────────

def test_create_chat_hands_the_workspace_and_title_to_the_rpc(http):
    http.reply("workspaces", WS)
    http.reply("rpc/create_chat", "chat-9")
    assert db.create_chat("u", "My chat") == "chat-9"
    assert http.of("rpc/create_chat")[0].json == {"p_workspace_id": "ws-1", "p_title": "My chat"}


def test_create_chat_without_a_workspace_never_reaches_the_rpc(http):
    http.reply("workspaces", [])
    http.reply("workspaces", [])                          # insert returns nothing
    assert db.create_chat("u", "t") is None
    assert http.of("rpc/create_chat") == []


def test_create_chat_returns_none_when_the_rpc_fails(http):
    http.reply("workspaces", WS)
    http.reply("rpc/create_chat", None, ok=False)
    assert db.create_chat("u", "t") is None


def test_a_non_string_rpc_result_is_not_passed_off_as_a_chat_id(http):
    # A SQL function that returns NULL comes back as JSON null. Handing that to
    # the client as a chat_id makes every later request 404 for no visible reason.
    http.reply("workspaces", WS)
    http.reply("rpc/create_chat", None)
    assert db.create_chat("u", "t") is None


# ── chat ownership ────────────────────────────────────────────────────────────
# The service-role key bypasses RLS. These two functions are the access check.

def test_a_chat_in_the_users_workspace_belongs_to_them(http):
    http.reply("workspaces", WS)
    http.reply("chats", [{"id": "c-1"}])
    assert db.chat_belongs_to_user("c-1", "u") is True


def test_the_ownership_query_filters_on_the_workspace_as_well_as_the_id(http):
    # Without the workspace_id filter this returns True for any chat id that
    # exists, which is every chat in the database.
    http.reply("workspaces", WS)
    http.reply("chats", [{"id": "c-1"}])
    db.chat_belongs_to_user("c-1", "u")
    assert http.of("chats")[0].params == {
        "id": "eq.c-1", "workspace_id": "eq.ws-1", "select": "id",
    }


def test_someone_elses_chat_does_not_belong_to_this_user(http):
    http.reply("workspaces", WS)
    http.reply("chats", [])
    assert db.chat_belongs_to_user("c-1", "u") is False


def test_a_user_with_no_workspace_owns_nothing_and_is_not_queried_further(http):
    http.reply("workspaces", [])
    assert db.chat_belongs_to_user("c-1", "u") is False
    assert http.of("chats") == []


def test_a_failed_ownership_lookup_denies_rather_than_allows(http):
    http.reply("workspaces", WS)
    http.reply("chats", [{"id": "c-1"}], ok=False)
    assert db.chat_belongs_to_user("c-1", "u") is False


# ── message ownership ─────────────────────────────────────────────────────────

def test_a_message_in_the_users_workspace_belongs_to_them(http):
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m-1"}])
    assert db.message_belongs_to_user("m-1", "u") is True


def test_the_message_check_joins_through_chats_to_the_workspace(http):
    # chats!inner makes the embedded filter a join condition. As a left join the
    # row comes back null-padded — and still truthy, which would make every
    # message id in the database belong to everyone.
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m-1"}])
    db.message_belongs_to_user("m-1", "u")
    params = http.of("messages")[0].params
    assert params["id"] == "eq.m-1"
    assert params["chats.workspace_id"] == "eq.ws-1"
    assert "chats!inner" in params["select"]


def test_a_message_outside_the_workspace_does_not_belong_to_the_user(http):
    http.reply("workspaces", WS)
    http.reply("messages", [])
    assert db.message_belongs_to_user("m-1", "u") is False


def test_message_ownership_without_a_workspace_stops_before_the_query(http):
    http.reply("workspaces", [])
    assert db.message_belongs_to_user("m-1", "u") is False
    assert http.of("messages") == []


def test_a_failed_message_lookup_denies(http):
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m-1"}], ok=False)
    assert db.message_belongs_to_user("m-1", "u") is False


# ── get_chats ─────────────────────────────────────────────────────────────────

def test_chats_come_back_with_their_message_count(http):
    http.reply("chats", [{"id": "c1", "title": "One", "created_at": "2026-01-01",
                          "messages": [{"count": 4}]}])
    assert db.get_chats("u") == [
        {"id": "c1", "title": "One", "created_at": "2026-01-01", "message_count": 4},
    ]


def test_a_chat_whose_messages_were_pruned_counts_zero_not_missing(http):
    # Only the 2 most recent chats keep their messages, so an empty aggregate is
    # the normal state of an older chat, not an error.
    http.reply("chats", [{"id": "c1", "title": "One", "created_at": "t", "messages": []}])
    assert db.get_chats("u")[0]["message_count"] == 0


def test_a_missing_aggregate_counts_zero(http):
    http.reply("chats", [{"id": "c1", "title": "One", "created_at": "t"}])
    assert db.get_chats("u")[0]["message_count"] == 0


def test_the_join_used_to_scope_chats_is_not_returned_to_the_client(http):
    http.reply("chats", [{"id": "c1", "title": "One", "created_at": "t",
                          "messages": [{"count": 1}],
                          "workspaces": {"owner_id": "u"}}])
    assert set(db.get_chats("u")[0]) == {"id", "title", "created_at", "message_count"}


def test_chats_are_scoped_by_owner_newest_first_and_capped_at_ten(http):
    http.reply("chats", [])
    db.get_chats("user-3")
    params = http.of("chats")[0].params
    assert params["workspaces.owner_id"] == "eq.user-3"
    assert params["order"] == "created_at.desc"
    assert params["limit"] == "10"
    assert "workspaces!inner" in params["select"]


def test_a_failed_chat_list_is_empty_not_an_exception(http):
    http.reply("chats", [{"id": "c1"}], ok=False)
    assert db.get_chats("u") == []


# ── save_messages ─────────────────────────────────────────────────────────────

def test_the_exchange_is_stored_as_two_rows_user_first(http):
    sources = [{"number": 1, "title": "T", "url": "u"}]
    http.reply("messages", [{"id": "m-u", "role": "user"}, {"id": "m-a", "role": "assistant"}])
    db.save_messages("c-1", "question?", "answer [1].", sources)
    rows = http.of("messages")[0].json
    assert [r["role"] for r in rows] == ["user", "assistant"]
    assert rows[0]["content"] == "question?"
    assert rows[0]["sources_json"] is None          # a question cites nothing
    assert rows[1]["content"] == "answer [1]."
    assert rows[1]["sources_json"] == sources
    assert all(r["chat_id"] == "c-1" for r in rows)


def test_the_assistant_row_id_is_what_comes_back(http):
    http.reply("messages", [{"id": "m-u", "role": "user"}, {"id": "m-a", "role": "assistant"}])
    assert db.save_messages("c", "q", "a", []) == "m-a"


def test_the_id_is_found_by_role_not_by_position(http):
    # Nothing in PostgREST promises the rows come back in insertion order, and
    # the wrong id here bookmarks the user's own question instead of the answer.
    http.reply("messages", [{"id": "m-a", "role": "assistant"}, {"id": "m-u", "role": "user"}])
    assert db.save_messages("c", "q", "a", []) == "m-a"


def test_a_failed_save_returns_no_id(http):
    # /ask treats this as "answer served, not bookmarkable" — it must not raise,
    # because the answer is already paid for.
    http.reply("messages", None, ok=False)
    assert db.save_messages("c", "q", "a", []) is None


def test_a_non_list_response_returns_no_id(http):
    http.reply("messages", {"message": "duplicate key"})
    assert db.save_messages("c", "q", "a", []) is None


def test_a_response_without_the_assistant_row_returns_no_id(http):
    http.reply("messages", [{"id": "m-u", "role": "user"}])
    assert db.save_messages("c", "q", "a", []) is None


# ── bookmarks ─────────────────────────────────────────────────────────────────

def test_saving_an_answer_keeps_the_note(http):
    http.reply("messages", [])
    assert db.set_bookmark("m-1", True, "read later") is True
    call = http.of("messages")[0]
    assert call.method == "PATCH"
    assert call.params == {"id": "eq.m-1"}
    assert call.json == {"bookmarked": True, "bookmark_note": "read later"}


def test_unsaving_clears_the_note_it_was_saved_with(http):
    # Otherwise the note survives, invisible, and reappears the next time the
    # same answer is bookmarked.
    http.reply("messages", [])
    db.set_bookmark("m-1", False, "read later")
    assert http.of("messages")[0].json == {"bookmarked": False, "bookmark_note": None}


def test_a_failed_patch_is_reported_as_failure(http):
    http.reply("messages", [], ok=False)
    assert db.set_bookmark("m-1", True, None) is False


def test_bookmarks_carry_the_title_of_the_chat_they_came_from(http):
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m1", "content": "a", "sources_json": [],
                             "created_at": "t", "bookmark_note": None, "chat_id": "c1",
                             "chats": {"title": "Retrieval", "workspace_id": "ws-1"}}])
    saved = db.get_bookmarks("u")
    assert saved[0]["chat_title"] == "Retrieval"
    assert "chats" not in saved[0]                 # the join is not the payload
    assert saved[0]["id"] == "m1"


def test_a_bookmark_whose_chat_is_gone_still_lists_with_an_empty_title(http):
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m1", "content": "a", "chats": None}])
    assert db.get_bookmarks("u")[0]["chat_title"] == ""


def test_bookmarks_are_scoped_to_the_workspace_and_to_saved_messages(http):
    http.reply("workspaces", WS)
    http.reply("messages", [])
    db.get_bookmarks("u")
    params = http.of("messages")[0].params
    assert params["bookmarked"] == "is.true"
    assert params["chats.workspace_id"] == "eq.ws-1"
    assert params["order"] == "created_at.desc"
    assert params["limit"] == "100"


def test_a_user_with_no_workspace_has_no_bookmarks_and_is_not_queried(http):
    http.reply("workspaces", [])
    assert db.get_bookmarks("u") == []
    assert http.of("messages") == []


def test_a_failed_bookmark_list_is_empty(http):
    http.reply("workspaces", WS)
    http.reply("messages", [{"id": "m1"}], ok=False)
    assert db.get_bookmarks("u") == []


# ── usage and plan ────────────────────────────────────────────────────────────

def test_the_usage_period_is_the_first_of_the_current_month():
    from datetime import date
    assert db._current_period() == date.today().replace(day=1).isoformat()


def test_queries_used_reads_this_months_row(http):
    http.reply("query_usage", [{"count": 42}])
    assert db.get_queries_used("u") == 42
    params = http.of("query_usage")[0].params
    assert params["user_id"] == "eq.u"
    assert params["period_start"] == f"eq.{db._current_period()}"


def test_a_user_with_no_usage_row_has_used_nothing(http):
    http.reply("query_usage", [])
    assert db.get_queries_used("u") == 0


def test_unreadable_usage_counts_as_zero_rather_than_raising(http):
    http.reply("query_usage", [{"count": 5}], ok=False)
    assert db.get_queries_used("u") == 0


def test_the_plan_is_read_from_the_profile(http):
    http.reply("users_profile", [{"plan": "pro"}])
    assert db.get_plan("u") == "pro"


@pytest.mark.parametrize("payload,ok", [([], True), (None, False), ([{"plan": "pro"}], False)])
def test_an_unreadable_profile_is_free_not_pro(http, payload, ok):
    # The fail-safe direction, and the one main.py's bookmark gate depends on:
    # a Supabase outage must not become a free Pro upgrade for everyone.
    http.reply("users_profile", payload, ok=ok)
    assert db.get_plan("u") == "free"


def test_refund_returns_the_new_count(http):
    http.reply("rpc/refund_query", 7)
    assert db.refund_query("u") == 7
    assert http.of("rpc/refund_query")[0].json == {"p_user_id": "u"}


def test_a_failed_refund_reports_none_rather_than_a_count(http):
    http.reply("rpc/refund_query", None, ok=False)
    assert db.refund_query("u") is None


def test_a_non_integer_refund_result_is_none(http):
    http.reply("rpc/refund_query", {"error": "function does not exist"})
    assert db.refund_query("u") is None


# ── get_profile ───────────────────────────────────────────────────────────────

def test_the_profile_combines_the_row_the_chunk_count_and_the_usage(http):
    http.reply("users_profile", [{"name": "Ada", "plan": "pro"}])
    http.reply("workspaces", WS)
    http.reply("chunk_usage", [{"chunks_indexed": 13280}])
    http.reply("query_usage", [{"count": 12}])
    assert db.get_profile("u") == {
        "name": "Ada", "plan": "pro", "chunks_indexed": 13280, "queries_used": 12,
    }


def test_a_missing_profile_row_still_answers_with_the_free_defaults(http):
    # The endpoint feeds the header and the usage meter; a 500 here logs the
    # user out of a working account.
    http.reply("users_profile", [])
    http.reply("workspaces", [])
    assert db.get_profile("u") == {
        "name": None, "plan": "free", "chunks_indexed": 0, "queries_used": 0,
    }


def test_a_workspace_with_no_usage_row_reports_zero_chunks(http):
    http.reply("users_profile", [{"name": "Ada", "plan": "free"}])
    http.reply("workspaces", WS)
    http.reply("chunk_usage", [])
    assert db.get_profile("u")["chunks_indexed"] == 0


def test_the_profile_read_never_creates_a_workspace(http):
    http.reply("users_profile", [{"name": "Ada", "plan": "free"}])
    http.reply("workspaces", [])
    db.get_profile("u")
    assert [c for c in http.calls if c.method == "POST"] == []


# ── clear_chats ───────────────────────────────────────────────────────────────

def test_clearing_deletes_every_chat_in_the_workspace(http):
    http.reply("workspaces", WS)
    db.clear_chats("u")
    call = http.of("chats")[0]
    assert call.method == "DELETE"
    assert call.params == {"workspace_id": "eq.ws-1"}


def test_clearing_deletes_nothing_when_the_workspace_cannot_be_resolved(http):
    # An unfiltered DELETE on `chats` would empty the table for every user.
    http.reply("workspaces", [])
    http.reply("workspaces", [])                          # insert returns nothing
    db.clear_chats("u")
    assert [c for c in http.calls if c.method == "DELETE"] == []


# ── get_chat_messages ─────────────────────────────────────────────────────────

def test_messages_are_returned_oldest_first_with_their_bookmark_state(http):
    rows = [{"id": "m1", "role": "user", "content": "q", "sources_json": None,
             "created_at": "t", "bookmarked": False, "bookmark_note": None}]
    http.reply("messages", rows)
    assert db.get_chat_messages("c-1") == rows
    params = http.of("messages")[0].params
    assert params["chat_id"] == "eq.c-1"
    assert params["order"] == "created_at.asc"           # a transcript, not a feed
    assert "bookmarked" in params["select"]


def test_a_failed_message_read_is_an_empty_transcript(http):
    http.reply("messages", [{"id": "m1"}], ok=False)
    assert db.get_chat_messages("c-1") == []


def test_reading_a_transcript_does_not_check_ownership_itself(http):
    # Deliberate: main.py calls chat_belongs_to_user first and 404s on failure.
    # Pinned so that if the endpoint's check is ever removed, the reviewer has
    # to come here and delete this test to make the layer look safe.
    http.reply("messages", [])
    db.get_chat_messages("c-1")
    assert http.of("workspaces") == []
