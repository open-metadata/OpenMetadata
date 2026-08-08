#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Evaluation Framework for the OpenMetadata fine-tuned semantic encoder.

Compares a fine-tuned model against the all-MiniLM-L6-v2 baseline on:
    1. MRR@10
    2. Recall@K  (K = 1, 5, 10)
    3. Semantic Cohesion Score

Usage:
    python -m metadata.ml.evaluate_encoder \\
        --fine-tuned openmetadata-finetuned-encoder/ \\
        --test-data training_pairs.json
"""
from __future__ import annotations

import argparse
import json
import logging
import os
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

BASELINE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def _cosine_sim_matrix(embeddings: np.ndarray) -> np.ndarray:
    """All-pairs cosine similarity matrix for L2-normalised embeddings."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    normed = embeddings / norms
    return normed @ normed.T


def _compute_mrr_at_k(
    sim_matrix: np.ndarray,
    positives: Dict[int, List[int]],
    k: int = 10,
) -> float:
    """Mean Reciprocal Rank @ K."""
    rrs: List[float] = []
    for q_idx, pos_indices in positives.items():
        if not pos_indices:
            continue
        sims = sim_matrix[q_idx].copy()
        sims[q_idx] = -1.0
        top_k = np.argsort(sims)[::-1][:k]
        pos_set = set(pos_indices)
        rr = 0.0
        for rank, idx in enumerate(top_k, start=1):
            if idx in pos_set:
                rr = 1.0 / rank
                break
        rrs.append(rr)
    return float(np.mean(rrs)) if rrs else 0.0


def _compute_recall_at_k(
    sim_matrix: np.ndarray,
    positives: Dict[int, List[int]],
    k: int,
) -> float:
    """Recall @ K."""
    recalls: List[float] = []
    for q_idx, pos_indices in positives.items():
        if not pos_indices:
            continue
        sims = sim_matrix[q_idx].copy()
        sims[q_idx] = -1.0
        top_k_set = set(np.argsort(sims)[::-1][:k].tolist())
        recalls.append(len(top_k_set & set(pos_indices)) / len(pos_indices))
    return float(np.mean(recalls)) if recalls else 0.0


def _compute_cohesion(
    model: SentenceTransformer,
    pairs: List[Dict[str, Any]],
) -> float:
    """
    Semantic Cohesion: mean cosine similarity of column pairs with
    label >= 0.5 (i.e. same-table or lineage-connected columns).
    """
    positive_pairs = [(p["text_a"], p["text_b"]) for p in pairs if p["label"] >= 0.5]
    if not positive_pairs:
        return 0.0

    all_a = [a for a, _ in positive_pairs]
    all_b = [b for _, b in positive_pairs]
    embs_a = model.encode(all_a, normalize_embeddings=True)
    embs_b = model.encode(all_b, normalize_embeddings=True)

    sims = [float(np.dot(embs_a[i], embs_b[i])) for i in range(len(positive_pairs))]
    return float(np.mean(sims))


# ---------------------------------------------------------------------------
# Build positive map
# ---------------------------------------------------------------------------

def _build_positive_map(
    pairs: List[Dict[str, Any]],
    threshold: float = 0.5,
) -> Tuple[List[str], Dict[int, List[int]]]:
    """Return (unique_texts, {query_idx: [positive_idx, ...]})."""
    text_to_idx: Dict[str, int] = {}
    all_texts: List[str] = []

    def _get_or_add(text: str) -> int:
        if text not in text_to_idx:
            text_to_idx[text] = len(all_texts)
            all_texts.append(text)
        return text_to_idx[text]

    positives: Dict[int, List[int]] = defaultdict(list)
    for pair in pairs:
        idx_a = _get_or_add(pair["text_a"])
        idx_b = _get_or_add(pair["text_b"])
        if pair["label"] >= threshold:
            positives[idx_a].append(idx_b)
            positives[idx_b].append(idx_a)

    return all_texts, dict(positives)


# ---------------------------------------------------------------------------
# Single model evaluation
# ---------------------------------------------------------------------------

def _eval_model(
    model: SentenceTransformer,
    model_name: str,
    all_texts: List[str],
    positives: Dict[int, List[int]],
    pairs: List[Dict[str, Any]],
) -> Dict[str, float]:
    """Run all metrics on one model."""
    logger.info("Encoding %d texts with %s …", len(all_texts), model_name)
    embeddings = model.encode(all_texts, normalize_embeddings=True, show_progress_bar=False)
    sim_matrix = _cosine_sim_matrix(embeddings)

    results = {
        "mrr": _compute_mrr_at_k(sim_matrix, positives, k=10),
        "recall_at_1": _compute_recall_at_k(sim_matrix, positives, k=1),
        "recall_at_5": _compute_recall_at_k(sim_matrix, positives, k=5),
        "recall_at_10": _compute_recall_at_k(sim_matrix, positives, k=10),
        "semantic_cohesion": _compute_cohesion(model, pairs),
    }
    return results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate(
    fine_tuned_path: Optional[str] = None,
    test_pairs: Optional[List[Dict[str, Any]]] = None,
    test_data_path: Optional[str] = None,
    output_path: str = "evaluation_results.json",
) -> Dict[str, Any]:
    """
    Evaluate fine-tuned encoder vs baseline.

    Args:
        fine_tuned_path: path to fine-tuned model directory.
        test_pairs: list of ``{text_a, text_b, label}`` dicts (in-memory).
        test_data_path: path to JSON file with test pairs.
        output_path: where to save ``evaluation_results.json``.

    Returns:
        flat dict with ``mrr``, ``recall_at_1``, ``recall_at_5``,
        ``recall_at_10``, ``semantic_cohesion``, and optionally
        ``baseline_mrr``, ``fine_tuned_mrr``, etc.
    """
    # Load pairs
    if test_pairs is None and test_data_path:
        with open(test_data_path, "r", encoding="utf-8") as f:
            test_pairs = json.load(f)
    if not test_pairs:
        raise ValueError("No test pairs provided (pass test_pairs or test_data_path)")

    all_texts, positives = _build_positive_map(test_pairs)
    logger.info("Unique texts: %d, queries with positives: %d", len(all_texts), len(positives))

    if not positives:
        logger.warning("No positive pairs — cannot compute ranking metrics.")
        empty = {"mrr": 0.0, "recall_at_1": 0.0, "recall_at_5": 0.0,
                 "recall_at_10": 0.0, "semantic_cohesion": 0.0}
        return empty

    # Baseline evaluation
    logger.info("=== Evaluating BASELINE: %s ===", BASELINE_MODEL)
    baseline_model = SentenceTransformer(BASELINE_MODEL)
    baseline = _eval_model(baseline_model, BASELINE_MODEL, all_texts, positives, test_pairs)
    del baseline_model

    # Fine-tuned evaluation
    finetuned: Optional[Dict[str, float]] = None
    if fine_tuned_path and os.path.isdir(fine_tuned_path):
        try:
            logger.info("=== Evaluating FINE-TUNED: %s ===", fine_tuned_path)
            ft_model = SentenceTransformer(fine_tuned_path)
            finetuned = _eval_model(ft_model, fine_tuned_path, all_texts, positives, test_pairs)
            del ft_model
        except Exception as exc:
            logger.error("Failed to load fine-tuned model: %s", exc)

    # Build result dict — primary keys come from the "best" model
    if finetuned is not None:
        results: Dict[str, Any] = dict(finetuned)
        for k, v in baseline.items():
            results[f"baseline_{k}"] = v
        for k, v in finetuned.items():
            results[f"fine_tuned_{k}"] = v
    else:
        results = dict(baseline)

    # Print comparison table
    header = f"\n{'=' * 70}\n{'Metric':<25} {'Baseline':>15}"
    if finetuned:
        header += f" {'Fine-Tuned':>15} {'Delta':>10}"
    header += f"\n{'=' * 70}"
    print(header)
    for metric in ["mrr", "recall_at_1", "recall_at_5", "recall_at_10", "semantic_cohesion"]:
        bval = baseline.get(metric, 0.0)
        line = f"{metric:<25} {bval:>15.4f}"
        if finetuned:
            ftval = finetuned.get(metric, 0.0)
            delta = ftval - bval
            line += f" {ftval:>15.4f} {delta:>+10.4f}"
        print(line)
    print("=" * 70 + "\n")

    # Save JSON
    output = {
        "baseline": {"model": BASELINE_MODEL, "metrics": baseline},
        "fine_tuned": (
            {"model": fine_tuned_path, "metrics": finetuned} if finetuned else None
        ),
        "num_test_pairs": len(test_pairs),
        "num_unique_texts": len(all_texts),
        **results,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    logger.info("Results saved to %s", output_path)

    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate fine-tuned encoder vs baseline on OpenMetadata search metrics."
    )
    parser.add_argument("--fine-tuned", default=None, help="Path to fine-tuned model dir")
    parser.add_argument("--test-data", required=True, help="Path to test pairs JSON")
    parser.add_argument("--output", default="evaluation_results.json", help="Output results JSON")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    evaluate(
        fine_tuned_path=args.fine_tuned,
        test_data_path=args.test_data,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
