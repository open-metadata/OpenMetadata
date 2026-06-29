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
Python Encoder Client — drop-in for Python-side embedding calls.

class MetadataEncoder:
    - Loads fine-tuned model from openmetadata-finetuned-encoder/ if present
    - Falls back to sentence-transformers/all-MiniLM-L6-v2
    - Normalises output vectors to unit length (cosine-similarity ready)
    - Uses @lru_cache on model loading (load once per process)

Usage:
    python -m metadata.ml.encoder_client --text "order_id orders table"
"""
from __future__ import annotations

import argparse
import logging
import os
from functools import lru_cache
from typing import List, Optional, Union

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

DEFAULT_FINETUNED_PATH = "openmetadata-finetuned-encoder"
FALLBACK_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _load_model(model_path: Optional[str] = None) -> SentenceTransformer:
    """
    Load the embedding model. Cached so only one load per process.

    Priority:
        1. Explicit model_path argument
        2. openmetadata-finetuned-encoder/ if it exists
        3. sentence-transformers/all-MiniLM-L6-v2  (fallback)
    """
    # Determine path
    resolved_path = model_path
    if resolved_path is None:
        if os.path.isdir(DEFAULT_FINETUNED_PATH):
            resolved_path = DEFAULT_FINETUNED_PATH
            logger.info("Found fine-tuned model at %s", resolved_path)
        else:
            resolved_path = FALLBACK_MODEL
            logger.info("Fine-tuned model not found. Using fallback: %s", resolved_path)

    try:
        model = SentenceTransformer(resolved_path)
        logger.info(
            "Loaded model: %s  (dimension=%d)",
            resolved_path,
            model.get_sentence_embedding_dimension(),
        )
        return model
    except Exception as exc:
        if resolved_path != FALLBACK_MODEL:
            logger.warning(
                "Failed to load model %s (%s). Falling back to %s.",
                resolved_path, exc, FALLBACK_MODEL,
            )
            return SentenceTransformer(FALLBACK_MODEL)
        raise


class MetadataEncoder:
    """
    Drop-in encoder for producing normalised embeddings from the
    fine-tuned (or baseline) sentence-transformer model.
    """

    def __init__(self, model_path: Optional[str] = None) -> None:
        self._model = _load_model(model_path)

    @property
    def dimension(self) -> int:
        return self._model.get_sentence_embedding_dimension()

    @property
    def model_name(self) -> str:
        """Best-effort model identifier."""
        # SentenceTransformer stores the original model name in _model_card_vars
        try:
            return self._model.model_card_data.model_name or str(self._model._model_config.get("_name_or_path", "unknown"))
        except Exception:
            return "unknown"

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 64,
        show_progress_bar: bool = False,
    ) -> np.ndarray:
        """
        Encode one or more texts into unit-length embedding vectors.

        Args:
            texts: A single string or list of strings.
            batch_size: Encoding batch size.
            show_progress_bar: Whether to show progress during encoding.

        Returns:
            numpy.ndarray of shape (n, dimension) with L2-normalised vectors.
        """
        single = isinstance(texts, str)
        if single:
            texts = [texts]

        embeddings = self._model.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=show_progress_bar,
        )

        # Ensure numpy array
        if not isinstance(embeddings, np.ndarray):
            embeddings = np.array(embeddings)

        return embeddings[0] if single else embeddings


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Produce embeddings using the OpenMetadata encoder."
    )
    parser.add_argument("--text", required=True, help="Text to encode")
    parser.add_argument(
        "--model", default=None,
        help="Explicit model path (default: auto-detect fine-tuned or fallback)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    encoder = MetadataEncoder(model_path=args.model)
    embedding = encoder.encode(args.text)

    print(f"Model:     {encoder.model_name}")
    print(f"Dimension: {encoder.dimension}")
    print(f"Shape:     {embedding.shape}")
    print(f"First 5:   {embedding[:5]}")
    print(f"L2 norm:   {np.linalg.norm(embedding):.6f}")


if __name__ == "__main__":
    main()
