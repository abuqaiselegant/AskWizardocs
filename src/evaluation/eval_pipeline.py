"""
eval_pipeline.py — Step 2: Run all golden Q&A through the RAG pipeline.

Reads golden_qa.jsonl → runs each question through search_with_rerank + generate
→ saves intermediate results to eval_results.jsonl for scoring.

Run separately from scorer so you don't pay API costs twice.
"""

import json
import time
from pathlib import Path

from src.retrieval.hybrid_retriever import search_with_rerank
from src.generation.generator import generate

COHERE_DELAY = 7  # seconds between questions — stays under 10 req/min Trial limit

GOLDEN_FILE  = Path("src/evaluation/golden_qa.jsonl")
RESULTS_FILE = Path("src/evaluation/eval_results.jsonl")


def run() -> list[dict]:
    pairs = [
        json.loads(line)
        for line in GOLDEN_FILE.read_text().splitlines()
        if line.strip()
    ]

    results = []
    for i, pair in enumerate(pairs, 1):
        question     = pair["question"]
        ground_truth = pair["ground_truth"]

        print(f"[{i}/{len(pairs)}] {question[:70]}...")

        chunks   = search_with_rerank(question)
        contexts = [c["text"] for c in chunks]
        result   = generate(question, chunks)

        results.append({
            "question":     question,
            "answer":       result["answer"],
            "contexts":     contexts,
            "ground_truth": ground_truth,
            # Carried through so scorer.py can break the means down per source.
            # A blended average over a corpus that is 72% HuggingFace cannot say
            # which source regressed.
            "source":       pair.get("source", ""),
        })

        if i < len(pairs):
            time.sleep(COHERE_DELAY)

    RESULTS_FILE.write_text("\n".join(json.dumps(r) for r in results))
    print(f"\n✅ {len(results)} questions complete → {RESULTS_FILE}")
    return results


if __name__ == "__main__":
    run()
