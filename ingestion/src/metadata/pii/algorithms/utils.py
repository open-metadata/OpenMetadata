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
from typing import Callable, DefaultDict, Mapping, Sequence, TypeVar

T = TypeVar("T")
S = TypeVar("S")


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


def group_by_average(
    scores: Mapping[T, float], key_fn: Callable[[T], S]
) -> Mapping[S, float]:
    """
    Group scores by a key function, computing the average score per group.

    This maintains the invariant that scores are in the range [0, 1],
    as long as the input scores are in that range.
    """
    result: DefaultDict[S, float] = defaultdict(float)
    counts: DefaultDict[S, int] = defaultdict(int)

    for key, score in scores.items():
        group = key_fn(key)
        result[group] += score
        counts[group] += 1

    # Calculate the average for each group
    for group in result:
        # Count is guaranteed to be non-zero since we only add to it
        result[group] /= counts[group]

    return result
