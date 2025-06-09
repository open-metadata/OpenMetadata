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
from collections import defaultdict
from typing import Callable, DefaultDict, Mapping, Optional, TypeVar

T = TypeVar("T")
S = TypeVar("S")


# Scores transformations


def scores_cleanup(
    scores: Mapping[T, float], min_score: float = 0.01, max_score: float = 1.0
) -> Mapping[T, float]:
    """
    Clean the scores mapping by removing keys with scores below the minimum score.
    Scores above the maximum score are capped to the maximum score.
    """
    if min_score > max_score:
        raise ValueError(
            f"Minimum score {min_score} cannot be greater than maximum score {max_score}."
        )
    return {
        key: min(score, max_score)
        for key, score in scores.items()
        if score >= min_score
    }


def scores_group_by(
    scores: Mapping[T, float], key_fn: Callable[[T], S]
) -> Mapping[S, float]:
    """
    Group the scores by a key function.
    The key function is applied to each key in `scores`,
    and the scores are averaged for each group, thus maintaining
    the score within the same range as the original one.
    """
    grouped: DefaultDict[S, float] = defaultdict(float)
    counts: DefaultDict[S, int] = defaultdict(int)

    # First, we count the occurrences of each key
    for key, score in scores.items():
        grouped[key_fn(key)] += score
        counts[key_fn(key)] += 1

    # Then, we average the scores by dividing by the count
    for key in grouped:
        grouped[key] /= counts[key]

    return grouped


def scores_to_probabilities(
    scores: Mapping[T, float], tolerance: float = 0.001
) -> Optional[Mapping[T, float]]:
    total = sum(scores.values())

    if total < tolerance:
        return None

    return {key: score / total for key, score in scores.items()}
