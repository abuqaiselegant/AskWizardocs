"""
chunk_schema.py — the one definition of what a chunk record looks like.

Three pipelines write chunks (scripts/langchain, scripts/huggingface × 2) and a
fourth module re-reads them into Chroma (embedder.py). Each used to build the
record and the Chroma metadata inline, which is how `chunk_id` went missing from
one of them: a bug with no exception, no crash, and no symptom except worse
answers. `vector_retriever.py` reads `meta.get("chunk_id", "")` and
`hybrid_retriever.py` keys RRF fusion on that value, so a missing one collapses
every vector hit into a single "" entry and pins the worst of them to rank 1.

Two functions, so that class of bug has nowhere to live:
    make_chunk()     — build a record for chunks.jsonl
    chunk_metadata() — project a record into what Chroma stores

The formats below are what the 13,280 already-indexed chunks use. Changing them
means re-embedding the corpus, so don't, unless that is the intent.
"""

import hashlib

# Fields Chroma keeps alongside the vector. chunk_id is the load-bearing one:
# it is what RRF fuses BM25 and vector hits on.
CHROMA_METADATA_FIELDS = ("source", "url", "title", "chunk_index", "chunk_id")


def doc_hash(doc_id: str) -> str:
    """Short stable hash of a document id, so chunk ids stay readable."""
    return hashlib.sha1(doc_id.encode("utf-8")).hexdigest()[:10]


def make_chunk_id(prefix: str, doc_id: str, index: int) -> str:
    """`<prefix>__<10-char hash>__c0000`.

    prefix is usually the source slug. The HuggingFace GitHub pipeline is the
    exception — it uses `hf_<library>`, so ids stay distinguishable per library
    inside a single `huggingface` source.
    """
    return f"{prefix}__{doc_hash(doc_id)}__c{index:04d}"


def make_chunk(
    *,
    source:     str,
    doc_id:     str,
    url:        str,
    title:      str,
    index:      int,
    start_char: int,
    end_char:   int,
    text:       str,
    id_prefix:  str | None = None,
    library:    str | None = None,
) -> dict:
    """One chunk record, in the shape chunks.jsonl already holds.

    Keyword-only: the callers pass eight-ish similar strings, and a positional
    signature there is a swap waiting to happen.
    """
    chunk = {
        "chunk_id":    make_chunk_id(id_prefix or source, doc_id, index),
        "source":      source,
        "doc_id":      doc_id,
        "url":         url,
        "title":       title,
        "chunk_index": index,
        "loc":         {"start_char": start_char, "end_char": end_char},
        "text":        text,
    }
    if library:
        # Only the HuggingFace pipeline sets this; key order matters only for
        # readability of the jsonl, not for correctness.
        chunk = {**chunk, "library": library}
    return chunk


def chunk_metadata(chunk: dict) -> dict:
    """What Chroma stores next to the vector.

    Indexes rather than .get()s the required fields on purpose: a chunk missing
    one should fail here, loudly, at ingestion time — not silently degrade
    retrieval months later.
    """
    meta = {field: chunk[field] for field in CHROMA_METADATA_FIELDS}
    if chunk.get("library"):
        meta["library"] = chunk["library"]
    return meta
