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
    generate_followups=lambda question, answer: [],
)
fake_llm.answer = ""

from src.generation.generator import generate                             # noqa: E402
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
