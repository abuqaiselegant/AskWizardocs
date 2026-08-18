"""
ci_gate.py — Step 5: Fail if faithfulness drops below threshold.

Usage:
    python -m src.evaluation.ci_gate

Exit codes:
    0 — all metrics pass
    1 — faithfulness < FAITHFULNESS_THRESHOLD
"""

import json
import sys
from pathlib import Path

SCORES_FILE             = Path("src/evaluation/results.json")
FAITHFULNESS_THRESHOLD  = 0.85


def check() -> None:
    if not SCORES_FILE.exists():
        print(f"❌ {SCORES_FILE} not found — run scorer.py first.")
        sys.exit(1)

    scores = json.loads(SCORES_FILE.read_text())

    print("=== Ragas Eval Results ===")
    for metric, val in scores.items():
        print(f"  {metric:<22} {val:.4f}")

    faithfulness = scores.get("faithfulness", 0.0)
    print(f"\nFaithfulness threshold: {FAITHFULNESS_THRESHOLD}")

    if faithfulness < FAITHFULNESS_THRESHOLD:
        print(f"❌ FAILED — faithfulness {faithfulness:.4f} < {FAITHFULNESS_THRESHOLD}")
        sys.exit(1)

    print(f"✅ PASSED — faithfulness {faithfulness:.4f} >= {FAITHFULNESS_THRESHOLD}")


if __name__ == "__main__":
    check()
