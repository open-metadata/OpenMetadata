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
Utility functions for PII algorithms
"""
from typing import Mapping, Sequence, TypeVar

T = TypeVar("T")


def normalize_scores(scores: Mapping[T, float], tol: float = 0.01) -> Mapping[T, float]:
    """
    Normalize the scores to sum to 1, while ignoring scores below the tolerance.
    Scores must be positive.
    """
    scores = {key: score for key, score in scores.items() if score > tol}
    total = sum(scores.values())
    if total == 0:
        return scores
    return {key: score / total for key, score in scores.items()}


def get_top_classes(scores: Mapping[T, float], n: int, threshold: float) -> Sequence[T]:
    """
    Get the top n scores from the scores mapping that are above the threshold.
    The classes are sorted in descending order of their scores.
    """
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_classes = [key for key, score in sorted_scores if score >= threshold]
    return top_classes[:n]
