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
Model Training Script for the OpenMetadata fine-tuned semantic encoder.

Uses sentence-transformers with a multi-objective loss:
    loss = 0.6 * CosineSimilarityLoss + 0.4 * MultipleNegativesRankingLoss

Default base model: answerdotai/ModernBERT-base
Fallback base model: sentence-transformers/all-MiniLM-L6-v2

Usage:
    python -m metadata.ml.train_encoder \\
        --data training_pairs.json \\
        --output openmetadata-finetuned-encoder/ \\
        --base-model answerdotai/ModernBERT-base \\
        --epochs 10
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
from typing import Any, Dict, List, Tuple

import torch
import torch.nn as nn
from datasets import Dataset
from sentence_transformers import (
    SentenceTransformer,
    InputExample,
    losses,
    evaluation,
)
from sentence_transformers.trainer import SentenceTransformerTrainer
from sentence_transformers.training_args import SentenceTransformerTrainingArguments
from transformers import EarlyStoppingCallback

logger = logging.getLogger(__name__)

DEFAULT_BASE_MODEL = "answerdotai/ModernBERT-base"
FALLBACK_BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_training_pairs(path: str) -> List[Dict[str, Any]]:
    """Load the JSON training pairs produced by training_data.py."""
    with open(path, "r", encoding="utf-8") as f:
        pairs = json.load(f)
    logger.info("Loaded %d training pairs from %s", len(pairs), path)
    return pairs


def split_data(
    pairs: List[Dict[str, Any]],
    val_ratio: float = 0.1,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Deterministic train/val split on the pair list.

    Guarantees at least 2 items in both train and validation sets
    (required by scipy.pearsonr in EmbeddingSimilarityEvaluator).

    Raises:
        ValueError: If fewer than 4 pairs are provided.
    """
    if len(pairs) < 4:
        raise ValueError(
            f"Need at least 4 training pairs for train/val split, got {len(pairs)}"
        )
    import random
    rng = random.Random(42)
    shuffled = list(pairs)
    rng.shuffle(shuffled)
    split_idx = max(2, int(len(shuffled) * (1 - val_ratio)))
    split_idx = min(split_idx, len(shuffled) - 2)
    return shuffled[:split_idx], shuffled[split_idx:]


def pairs_to_input_examples(pairs: List[Dict[str, Any]]) -> List[InputExample]:
    """Convert raw pair dicts into sentence-transformers InputExamples."""
    examples = []
    for pair in pairs:
        examples.append(InputExample(
            texts=[pair["text_a"], pair["text_b"]],
            label=float(pair["label"]),
        ))
    return examples


def pairs_to_dataset(pairs: List[Dict[str, Any]]) -> Dataset:
    """Convert raw pair dicts into a HuggingFace Dataset for the Trainer API."""
    return Dataset.from_dict({
        "sentence1": [p["text_a"] for p in pairs],
        "sentence2": [p["text_b"] for p in pairs],
        "label": [float(p["label"]) for p in pairs],
    })


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train(
    data_path: str,
    output_dir: str,
    base_model: str = DEFAULT_BASE_MODEL,
    epochs: int = 10,
    batch_size: int = 32,
    learning_rate: float = 2e-5,
    warmup_ratio: float = 0.1,
    early_stopping_patience: int = 3,
) -> str:
    """
    Fine-tune a sentence encoder on OpenMetadata training pairs.

    Returns the path to the saved fine-tuned model.
    """
    logger.info("Loading base model: %s", base_model)
    try:
        model = SentenceTransformer(base_model)
    except Exception as exc:
        logger.warning(
            "Could not load base model %s (%s). Falling back to %s.",
            base_model, exc, FALLBACK_BASE_MODEL,
        )
        model = SentenceTransformer(FALLBACK_BASE_MODEL)

    # Load and split data
    all_pairs = load_training_pairs(data_path)
    if not all_pairs:
        raise ValueError(f"No training pairs found in {data_path}")

    train_pairs, val_pairs = split_data(all_pairs)
    logger.info("Train: %d pairs, Validation: %d pairs", len(train_pairs), len(val_pairs))

    # Convert to HuggingFace Dataset (required by sentence-transformers v5+)
    train_dataset = pairs_to_dataset(train_pairs)
    eval_dataset = pairs_to_dataset(val_pairs)

    # Multi-objective loss
    # 0.6 * CosineSimilarityLoss + 0.4 * MultipleNegativesRankingLoss
    cosine_loss = losses.CosineSimilarityLoss(model=model)
    mnrl_loss = losses.MultipleNegativesRankingLoss(model=model)

    # Combine both losses with a weighted wrapper so both contribute
    # to the gradient during training.  MNRL only receives positive
    # pairs (label >= 0.5) since it treats every input pair as a true
    # match and uses in-batch negatives.
    class _WeightedLoss(nn.Module):
        """Weighted combination of two sentence-transformer losses.

        CosineSimilarityLoss receives all pairs (uses explicit labels).
        MultipleNegativesRankingLoss receives only positive pairs
        (label >= 0.5) because it ignores the label tensor and treats
        every (sentence1, sentence2) as a true positive match.
        """

        def __init__(self, loss_a: nn.Module, loss_b: nn.Module,
                     weight_a: float = 0.6, weight_b: float = 0.4):
            super().__init__()
            self.loss_a = loss_a
            self.loss_b = loss_b
            self.weight_a = weight_a
            self.weight_b = weight_b

        def forward(self, sentence_features, labels):
            cosine_out = self.loss_a(sentence_features, labels)
            # MNRL only makes sense for positive pairs;
            # filter batch to label >= 0.5
            pos_mask = labels >= 0.5
            if pos_mask.any():
                pos_features = [
                    {k: v[pos_mask] for k, v in sf.items()}
                    for sf in sentence_features
                ]
                mnrl_out = self.loss_b(pos_features, labels[pos_mask])
            else:
                mnrl_out = torch.tensor(0.0, device=labels.device)
            return self.weight_a * cosine_out + self.weight_b * mnrl_out

    combined_loss = _WeightedLoss(cosine_loss, mnrl_loss, 0.6, 0.4)

    # Evaluation
    val_examples = pairs_to_input_examples(val_pairs)
    val_sentences1 = [ex.texts[0] for ex in val_examples]
    val_sentences2 = [ex.texts[1] for ex in val_examples]
    val_scores = [ex.label for ex in val_examples]

    evaluator = evaluation.EmbeddingSimilarityEvaluator(
        val_sentences1,
        val_sentences2,
        val_scores,
        name="om-val",
        show_progress_bar=False,
    )

    # Compute training steps
    total_steps = math.ceil(len(train_pairs) / batch_size) * epochs
    warmup_steps = int(total_steps * warmup_ratio)

    logger.info(
        "Training config: epochs=%d, batch_size=%d, lr=%s, warmup_steps=%d, total_steps=%d, patience=%d",
        epochs, batch_size, learning_rate, warmup_steps, total_steps, early_stopping_patience,
    )

    # Use the SentenceTransformerTrainingArguments + Trainer API
    # for proper early stopping and save-best-model support
    training_args = SentenceTransformerTrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        learning_rate=learning_rate,
        warmup_steps=warmup_steps,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="om-val_spearman_cosine",
        greater_is_better=True,
        logging_steps=50,
        fp16=False,
    )

    trainer = SentenceTransformerTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        loss=combined_loss,
        evaluator=evaluator,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=early_stopping_patience)],
    )

    logger.info("Starting fine-tuning...")
    trainer.train()

    # Save the best model
    model.save(output_dir)
    logger.info("Fine-tuned model saved to: %s", output_dir)

    # Run final evaluation
    final_score = evaluator(model, output_path=output_dir)
    logger.info("Final validation score (cosine similarity): %.4f", final_score)

    return output_dir


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fine-tune a semantic encoder for OpenMetadata search."
    )
    parser.add_argument("--data", required=True, help="Path to training_pairs.json")
    parser.add_argument("--output", default="openmetadata-finetuned-encoder/", help="Output model directory")
    parser.add_argument("--base-model", default=DEFAULT_BASE_MODEL, help="Base model to fine-tune")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Training batch size")
    parser.add_argument("--lr", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--warmup-ratio", type=float, default=0.1, help="Warmup ratio")
    parser.add_argument("--patience", type=int, default=3, help="Early stopping patience")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    train(
        data_path=args.data,
        output_dir=args.output,
        base_model=args.base_model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        warmup_ratio=args.warmup_ratio,
        early_stopping_patience=args.patience,
    )


if __name__ == "__main__":
    main()
