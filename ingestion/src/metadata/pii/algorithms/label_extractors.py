from abc import ABC, abstractmethod
from typing import Generic, Mapping, Set, TypeVar, final

from metadata.pii.algorithms.scoring_ops import scores_cleanup, scores_to_probabilities

T = TypeVar("T")


class LabelExtractor(ABC, Generic[T]):
    """
    Protocol for extracting labels from a mapping of label scores.

    This goal is to abstract the logic of how labels are extracted
    from the scores, allowing different strategies to be implemented
    depending on the underlying algorithm or use-case.
    """

    @abstractmethod
    def extract_labels(self, scores: Mapping[T, float]) -> Set[T]:
        """
        Extract labels from the given scores mapping.

        Args:
            scores (Mapping[T, float]): A mapping from labels to scores or probabilities.

        Returns:
            Set[T]: A set of labels extracted from the scores.
        """


@final
class ProbabilisticLabelExtractor(LabelExtractor[T], Generic[T]):
    """
    Extracts the most probable label(s) from a set of raw class scores using score filtering
    and probability normalization.

    This extractor treats the input scores as representing a multiclass classification scenario,
    where only one or a few mutually exclusive labels are expected to be true. It filters out
    low-confidence scores, normalizes the remaining ones into a probability distribution, and
    returns the top-k labels that meet a minimum probability threshold.

    After normalization, scores are interpreted as probabilities—that is, each label's
    value represents its relative likelihood among the remaining candidates.

    Args:
        k (int): The number of top labels to consider based on normalized probability.
        score_threshold (float): Minimum raw score required to keep a label before normalization.
        prob_threshold (float): Minimum normalized probability required for a label to be returned.

    Returns:
        Set[T]: A set of labels that pass both score and probability thresholds.

    Notes:
        - If only one label remains after score filtering, it will have a probability of 1.0
          and will always be returned if `k >= 1`.
        - When multiple labels remain, their probabilities may be lower, and some or all
          may fall below the `prob_threshold`.
        - This approach implicitly encodes a confidence mechanism: a label must be
          both strong enough in raw score and relatively dominant in probability to be selected.
    """

    def __init__(
        self,
        k: int,
        score_threshold: float,
        prob_threshold: float,
    ) -> None:

        if not (0 <= score_threshold <= 1):
            raise ValueError("score_threshold must be between 0 and 1")
        if not (0 <= prob_threshold <= 1):
            raise ValueError("prob_threshold must be between 0 and 1")
        if k < 1:
            raise ValueError("k must be at least 1")

        self._score_threshold = score_threshold
        self._prob_threshold = prob_threshold
        self._k = k

    def extract_labels(self, scores: Mapping[T, float]) -> Set[T]:
        """
        Applies filtering and probability-based selection to extract high-confidence labels.
        """
        filtered_scores = scores_cleanup(
            scores, min_score=self._score_threshold, max_score=1.0
        )

        probabilities = scores_to_probabilities(filtered_scores)

        if probabilities is None:
            return set()

        top_k = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)[
            : self._k
        ]

        return {label for label, prob in top_k if prob >= self._prob_threshold}
