"""
test_pure_functions.py — the deterministic parts of the RAG pipeline.

These are the functions where a regression is silent: nothing raises, /ask still
returns 200, and the only symptom is worse answers or a number on screen that
the pipeline never measured. Everything here runs offline — no OpenAI, Cohere,
Chroma or Supabase call, and no corpus on disk.

Run:  pytest tests/ -q
"""

import sys
import types

from src.generation.formatter import format_context
from src.generation.parser import SNIPPET_CHARS, _snippet, extract_citations
from src.ingestion.chunk_schema import chunk_metadata, make_chunk, make_chunk_id


# ── Import-time stand-ins ─────────────────────────────────────────────────────
# hybrid_retriever and generator reach the heavy modules at import: BM25 builds
# its entire index in module scope, and the Chroma / OpenAI / Cohere clients are
# constructed the same way. Registering stand-ins in sys.modules first is what
# keeps these tests to pure functions instead of requiring five API keys and a
# 20 MB corpus to assert that 1/(60+1) is bigger than 1/(60+2).
def _stub(name: str, **members) -> types.ModuleType:
    mod = types.ModuleType(name)
    for key, value in members.items():
        setattr(mod, key, value)
    sys.modules[name] = mod
    parent, _, leaf = name.rpartition(".")
    if parent:
        setattr(__import__(parent, fromlist=[leaf]), leaf, mod)
    return mod


_stub("src.retrieval.bm25_retriever",   search=lambda *a, **k: [])
_stub("src.retrieval.vector_retriever", search=lambda *a, **k: [])
_stub("src.retrieval.reranker",         rerank=lambda query, chunks: chunks[:5])

# The fake LLM echoes whatever a test parks in `.answer`, read at call time so a
# test can set it after generator.py has already bound the name at import.
fake_llm = _stub(
    "src.generation.llm",
    generate=lambda query, context, history=None: fake_llm.answer,
    generate_followups=lambda question, answer: list(fake_llm.followups),
    # The streaming call replays whatever fragments a test parks here, so the
    # event protocol can be asserted without an OpenAI stream.
    generate_stream=lambda query, context, history=None: iter(fake_llm.fragments),
)
fake_llm.answer = ""
fake_llm.fragments = []
fake_llm.followups = []

from src.generation.generator import ask_stream, generate, retrieval_query  # noqa: E402
from src.retrieval.hybrid_retriever import RRF_K, reciprocal_rank_fusion  # noqa: E402


def chunk(cid: str, **extra) -> dict:
    """A retrieved chunk with the keys every downstream stage expects."""
    return {
        "chunk_id": cid,
        "source":   "langchain",
        "url":      f"https://docs.example/{cid}",
        "title":    f"Title {cid}",
        "text":     f"Body text for {cid}.",
        **extra,
    }


# ── formatter.format_context ──────────────────────────────────────────────────
# The numbering here IS the citation contract: [N] in the prompt has to line up
# with chunks[N-1], because parser.py maps the model's [N] straight back by index.

def test_format_context_numbers_from_one_and_separates_with_a_blank_line():
    out = format_context([chunk("a"), chunk("b")])
    assert out == "[1] Body text for a.\n\n[2] Body text for b."


def test_format_context_strips_surrounding_whitespace_from_chunk_text():
    assert format_context([chunk("a", text="  padded\n")]) == "[1] padded"


def test_format_context_of_no_chunks_is_empty():
    assert format_context([]) == ""


# ── parser._snippet ───────────────────────────────────────────────────────────

def test_snippet_collapses_newlines_and_runs_of_spaces():
    assert _snippet("one\n\ntwo   three\t four") == "one two three four"


def test_short_text_is_returned_whole_and_unmarked():
    text = "Short enough to keep."
    assert _snippet(text) == text


def test_long_text_is_cut_on_a_word_boundary_and_marked():
    out = _snippet(("alpha " * 200).strip())
    assert out.endswith("…")
    assert len(out) <= SNIPPET_CHARS + 1
    assert "alph…" not in out          # never cuts mid-word when a space exists


def test_unbroken_text_longer_than_the_limit_is_hard_cut():
    out = _snippet("x" * (SNIPPET_CHARS + 50))
    assert out == "x" * SNIPPET_CHARS + "…"


# ── parser.extract_citations ──────────────────────────────────────────────────

def test_citations_map_to_the_chunk_at_that_index():
    chunks = [chunk("a"), chunk("b", rerank_score=0.42)]
    sources = extract_citations("Claim [2].", chunks)
    assert [s["number"] for s in sources] == [2]
    assert sources[0]["title"]   == "Title b"
    assert sources[0]["url"]     == "https://docs.example/b"
    assert sources[0]["source"]  == "langchain"
    assert sources[0]["score"]   == 0.42
    assert sources[0]["snippet"] == "Body text for b."


def test_sources_come_back_in_citation_order_not_chunk_order():
    sources = extract_citations("First [3], then [1].", [chunk("a"), chunk("b"), chunk("c")])
    assert [s["number"] for s in sources] == [3, 1]


def test_a_number_cited_repeatedly_appears_once():
    sources = extract_citations("[1] and again [1] and [2] and [1].", [chunk("a"), chunk("b")])
    assert [s["number"] for s in sources] == [1, 2]


def test_out_of_range_citations_are_stripped():
    # [0] and [3] have no chunk behind them; a hallucinated index must not
    # index backwards into the list or raise.
    sources = extract_citations("[0] [1] [3] [99]", [chunk("a"), chunk("b")])
    assert [s["number"] for s in sources] == [1]


def test_an_answer_with_no_citations_yields_no_sources():
    assert extract_citations("I don't know based on the provided documentation.", [chunk("a")]) == []


def test_score_is_none_when_the_chunk_was_never_reranked():
    # The Cohere fallback path: chunks arrive in RRF order carrying no score.
    # None is what lets the UI say nothing instead of inventing a match value.
    sources = extract_citations("Claim [1].", [chunk("a")])
    assert sources[0]["score"] is None


# ── hybrid_retriever.reciprocal_rank_fusion ───────────────────────────────────

def test_agreement_beats_a_single_first_place():
    # The whole reason RRF is here, per the module docstring: a chunk ranked 2nd
    # by both retrievers must outrank one ranked 1st by only one of them.
    bm25   = [chunk("solo"), chunk("both")]
    vector = [chunk("other"), chunk("both")]
    assert [c["chunk_id"] for c in reciprocal_rank_fusion(bm25, vector)][0] == "both"


def test_rrf_score_is_the_sum_of_one_over_k_plus_rank():
    fused = {c["chunk_id"]: c["rrf_score"] for c in reciprocal_rank_fusion(
        [chunk("x"), chunk("y")], [chunk("y")]
    )}
    assert fused["x"] == round(1 / (RRF_K + 1), 6)
    assert fused["y"] == round(1 / (RRF_K + 2) + 1 / (RRF_K + 1), 6)


def test_a_chunk_in_both_lists_is_returned_once():
    fused = reciprocal_rank_fusion([chunk("a"), chunk("b")], [chunk("b"), chunk("a")])
    assert sorted(c["chunk_id"] for c in fused) == ["a", "b"]


def test_results_are_ordered_by_descending_score():
    scores = [c["rrf_score"] for c in reciprocal_rank_fusion(
        [chunk("a"), chunk("b"), chunk("c")], [chunk("c")]
    )]
    assert scores == sorted(scores, reverse=True)


def test_fusing_two_empty_lists_yields_nothing():
    assert reciprocal_rank_fusion([], []) == []


# ── generator.generate — the confidence contract ──────────────────────────────
# A number on the meter has to be a number the reranker produced. Anything else
# is a guess wearing a percentage sign.

def test_confidence_is_the_top_chunks_rerank_score():
    fake_llm.answer = "Grounded claim [1]."
    result = generate("q", [chunk("a", rerank_score=0.9123456), chunk("b", rerank_score=0.2)])
    assert result["confidence"] == 0.9123
    assert [s["number"] for s in result["sources"]] == [1]


def test_confidence_follows_the_first_chunk_not_the_best_score():
    # rerank() returns its results already sorted, so chunks[0] is the top one.
    # If that ever stops being true this test is the thing that notices.
    fake_llm.answer = "Grounded claim [1]."
    assert generate("q", [chunk("a", rerank_score=0.30), chunk("b", rerank_score=0.99)])["confidence"] == 0.30


def test_confidence_is_none_when_the_reranker_fell_back_to_rrf_order():
    fake_llm.answer = "Grounded claim [1]."
    assert generate("q", [chunk("a"), chunk("b")])["confidence"] is None


def test_confidence_is_none_when_nothing_was_retrieved():
    fake_llm.answer = "I don't know based on the provided documentation."
    result = generate("q", [])
    assert result["confidence"] is None
    assert result["sources"] == []


# ── chunk_schema — the ingestion contract ─────────────────────────────────────
# Five writers used to build these records inline. The bug that motivated
# collapsing them left chunk_id out of the Chroma metadata, which raises nothing
# and shows up only as worse answers.

def test_chunk_id_matches_the_format_the_indexed_corpus_uses():
    # Pinned against a real row of chunks.jsonl. 13,280 chunks are already
    # embedded under this scheme — changing the hash orphans every one of them.
    assert make_chunk_id("langchain", "https://docs.langchain.com", 0) == \
        "langchain__c4db8c60ce__c0000"


def test_chunk_index_is_zero_padded_to_four_digits():
    assert make_chunk_id("s", "d", 7).endswith("__c0007")
    assert make_chunk_id("s", "d", 1234).endswith("__c1234")


def test_id_prefix_overrides_the_source_slug():
    # The HuggingFace GitHub pipeline keeps ids per library inside one source.
    cid = make_chunk_id("hf_peft", "https://example/doc", 0)
    assert cid.startswith("hf_peft__")


def test_make_chunk_builds_the_stored_record():
    c = make_chunk(source="chromadb", doc_id="d", url="u", title="t",
                   index=3, start_char=10, end_char=20, text="body")
    assert c["source"]      == "chromadb"
    assert c["chunk_index"] == 3
    assert c["loc"]         == {"start_char": 10, "end_char": 20}
    assert c["text"]        == "body"
    assert c["chunk_id"]    == make_chunk_id("chromadb", "d", 3)
    assert "library" not in c


def test_library_is_recorded_only_when_given():
    c = make_chunk(source="huggingface", doc_id="d", url="u", title="t", index=0,
                   start_char=0, end_char=1, text="x",
                   id_prefix="hf_trl", library="trl")
    assert c["library"] == "trl"
    assert chunk_metadata(c)["library"] == "trl"


def test_metadata_always_carries_chunk_id():
    # The whole point of the module. RRF fuses BM25 and vector hits on this
    # value; without it every vector hit collapses into one "" entry.
    c = make_chunk(source="langchain", doc_id="d", url="u", title="t", index=0,
                   start_char=0, end_char=1, text="x")
    assert chunk_metadata(c)["chunk_id"] == c["chunk_id"]


def test_metadata_carries_exactly_the_indexed_fields():
    c = make_chunk(source="langchain", doc_id="d", url="u", title="t", index=0,
                   start_char=0, end_char=1, text="x")
    assert set(chunk_metadata(c)) == {"source", "url", "title", "chunk_index", "chunk_id"}
    assert "text" not in chunk_metadata(c)     # the document, not metadata


def test_metadata_raises_on_a_chunk_missing_a_required_field():
    # Loud at ingestion time beats silent degradation months later.
    try:
        chunk_metadata({"source": "s", "url": "u", "title": "t", "chunk_index": 0})
    except KeyError as e:
        assert "chunk_id" in str(e)
    else:
        raise AssertionError("expected KeyError for the missing chunk_id")


# ── generator.retrieval_query ─────────────────────────────────────────────────
# ask() and ask_stream() share this. If they ever retrieved differently for the
# same question, the only symptom would be "the streamed answer is worse".

def test_retrieval_query_is_the_bare_question_with_no_history():
    assert retrieval_query("what is LoRA?") == "what is LoRA?"


def test_retrieval_query_prepends_the_last_user_turn_for_follow_ups():
    history = [{"role": "user", "content": "what is LoRA?"},
               {"role": "assistant", "content": "A low-rank method [1]."}]
    assert retrieval_query("explain more", history) == "what is LoRA? explain more"


def test_retrieval_query_ignores_assistant_turns_when_looking_back():
    history = [{"role": "user", "content": "first"},
               {"role": "assistant", "content": "answer"},
               {"role": "user", "content": "second"},
               {"role": "assistant", "content": "answer"}]
    assert retrieval_query("more", history) == "second more"


# ── generator.ask_stream ──────────────────────────────────────────────────────
# The event protocol IS the contract with the browser: meta first (so the
# confidence meter can render before any text), deltas in order, done last with
# everything that could only be known after the answer finished.

def _run_stream(monkeypatch, fragments, chunks, followups=()):
    import src.generation.generator as gen
    monkeypatch.setattr(gen, "search_with_rerank", lambda q, source=None: chunks)
    fake_llm.fragments = fragments
    fake_llm.followups = list(followups)
    return list(ask_stream("q"))


def test_stream_emits_meta_first_carrying_the_confidence(monkeypatch):
    events = _run_stream(monkeypatch, ["hi"], [chunk("a", rerank_score=0.9132)])
    assert events[0] == ("meta", {"confidence": 0.9132})


def test_stream_meta_confidence_is_none_when_rerank_reported_no_score(monkeypatch):
    events = _run_stream(monkeypatch, ["hi"], [chunk("a")])
    assert events[0] == ("meta", {"confidence": None})


def test_stream_emits_every_fragment_in_order(monkeypatch):
    events = _run_stream(monkeypatch, ["Lo", "RA is ", "low-rank."], [chunk("a")])
    assert [p for e, p in events if e == "delta"] == ["Lo", "RA is ", "low-rank."]


def test_stream_ends_with_done_and_nothing_after_it(monkeypatch):
    events = _run_stream(monkeypatch, ["x"], [chunk("a")])
    assert [e for e, _ in events] == ["meta", "delta", "done"]


def test_streamed_answer_is_exactly_the_concatenated_deltas(monkeypatch):
    # If these drift, the reader and the stored message disagree about what was
    # said — and the bookmark saves the version nobody read.
    events = _run_stream(monkeypatch, ["one ", "two ", "three"], [chunk("a")])
    deltas = "".join(p for e, p in events if e == "delta")
    done   = next(p for e, p in events if e == "done")
    assert done["answer"] == deltas == "one two three"


def test_stream_drops_leading_whitespace_before_it_reaches_the_reader(monkeypatch):
    # generate() strips its answer, so the streamed text has to strip too or the
    # displayed answer starts a line lower than the one that gets stored.
    events = _run_stream(monkeypatch, ["\n\n", "  Answer [1]"], [chunk("a")])
    deltas = "".join(p for e, p in events if e == "delta")
    done   = next(p for e, p in events if e == "done")
    assert deltas == "Answer [1]"
    assert done["answer"] == "Answer [1]"


def test_stream_keeps_whitespace_that_is_inside_the_answer(monkeypatch):
    events = _run_stream(monkeypatch, ["A [1].", "\n\n", "B [1]."], [chunk("a")])
    assert next(p for e, p in events if e == "done")["answer"] == "A [1].\n\nB [1]."


def test_stream_done_carries_citations_resolved_against_the_chunks(monkeypatch):
    chunks = [chunk("a"), chunk("b")]
    events = _run_stream(monkeypatch, ["see [2] only"], chunks)
    sources = next(p for e, p in events if e == "done")["sources"]
    assert [s["number"] for s in sources] == [2]
    assert sources[0]["title"] == "Title b"


def test_stream_done_carries_the_followups(monkeypatch):
    events = _run_stream(monkeypatch, ["x"], [chunk("a")], followups=["one?", "two?"])
    assert next(p for e, p in events if e == "done")["followups"] == ["one?", "two?"]


def test_stream_of_an_empty_generation_still_completes(monkeypatch):
    # An empty stream must not hang or skip `done` — the client leaves the
    # composer disabled until it arrives.
    events = _run_stream(monkeypatch, [], [chunk("a")])
    assert [e for e, _ in events] == ["meta", "done"]
    assert next(p for e, p in events if e == "done")["answer"] == ""
