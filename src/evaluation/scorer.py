"""
scorer.py — Step 3 & 4: Score eval results with Ragas, save to results.json.

Metrics:
    faithfulness      — is every claim in the answer grounded in retrieved context?
    answer_relevancy  — does the answer actually address the question?
    context_precision — are the most relevant chunks ranked highest?

LLM: gpt-4o-mini (consistent with generation, adequate for scoring at this stage).
"""

import json
import os
from pathlib import Path

import warnings

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings as LCOpenAIEmbeddings
from openai import OpenAI
from ragas import EvaluationDataset, evaluate
from ragas.dataset_schema import SingleTurnSample
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import llm_factory
from ragas.metrics._answer_relevance import answer_relevancy
from ragas.metrics._context_precision import context_precision
from ragas.metrics._faithfulness import faithfulness

load_dotenv()

RESULTS_FILE = Path("src/evaluation/eval_results.jsonl")
SCORES_FILE  = Path("src/evaluation/results.json")

EVAL_MODEL  = "gpt-4o-mini"
EMBED_MODEL = "text-embedding-3-small"


def score() -> dict:
    rows = [
        json.loads(line)
        for line in RESULTS_FILE.read_text().splitlines()
        if line.strip()
    ]

    samples = [
        SingleTurnSample(
            user_input         = r["question"],
            response           = r["answer"],
            retrieved_contexts = r["contexts"],
            reference          = r["ground_truth"],
        )
        for r in rows
    ]

    dataset = EvaluationDataset(samples=samples)

    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    llm           = llm_factory(EVAL_MODEL, client=openai_client)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        embeddings = LangchainEmbeddingsWrapper(LCOpenAIEmbeddings(model=EMBED_MODEL))

    print(f"Scoring {len(samples)} samples with Ragas ({EVAL_MODEL})...\n")
    result = evaluate(
        dataset,
        metrics    = [faithfulness, answer_relevancy, context_precision],
        llm        = llm,
        embeddings = embeddings,
    )

    scores_df   = result.to_pandas()
    mean_scores = scores_df[
        ["faithfulness", "answer_relevancy", "context_precision"]
    ].mean().to_dict()

    SCORES_FILE.write_text(json.dumps(mean_scores, indent=2))

    print(f"\n✅ Scores saved to {SCORES_FILE}")
    for metric, val in mean_scores.items():
        print(f"   {metric:<22} {val:.4f}")

    return mean_scores


if __name__ == "__main__":
    score()
