from typing import TYPE_CHECKING, Any, Iterable, List, Optional, Sequence, final

if TYPE_CHECKING:
    from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.pii.algorithms.preprocessing import preprocess_values
from metadata.pii.algorithms.presidio_utils import (
    load_nlp_engine,
    set_presidio_logger_level,
)
from metadata.pii.models import ScoredTag
from metadata.pii.tag_analyzer import TagAnalysis, TagAnalyzer


@final
class TagScorer:
    """
    Tag classifier that returns ScoredTag objects with detailed match information.
    """

    def __init__(
        self,
        *,
        tag_analyzers: Iterable[TagAnalyzer],
        column_name_contribution: float = 0.5,
        score_cutoff: float = 0.1,
        relative_cardinality_cutoff: float = 0.01,
    ):
        set_presidio_logger_level()

        self._analyzers = list(tag_analyzers)

        self._column_name_contribution = column_name_contribution
        self._score_cutoff = score_cutoff
        self._relative_cardinality_cutoff = relative_cardinality_cutoff

    def predict_scores(
        self,
        sample_data: Sequence[Any],
        column_name: Optional[str] = None,
        _column_data_type: Optional[DataType] = None,
    ) -> List[ScoredTag]:
        str_values = preprocess_values(sample_data)

        if not str_values:
            return []

        # Relative cardinality test
        unique_values = set(str_values)
        if len(unique_values) / len(str_values) < self._relative_cardinality_cutoff:
            return []

        results: List[ScoredTag] = []
        for analyzer in self._analyzers:
            content_analysis = analyzer.analyze_content(values=str_values)
            content_score = content_analysis.score

            column_analysis = None
            column_score = 0.0
            if column_name is not None:
                column_analysis = analyzer.analyze_column()
                column_score = column_analysis.score

                column_score *= max(column_score, self._column_name_contribution)

            total_score = content_score + column_score
            if total_score > self._score_cutoff:
                reason = self._build_reason(
                    content_analysis=content_analysis,
                    column_analysis=column_analysis,
                )

                scored_tag = ScoredTag(
                    tag=analyzer.tag,
                    score=total_score,
                    reason=reason,
                )

                results.append(scored_tag)

        return results

    def _build_reason(
        self, content_analysis: TagAnalysis, column_analysis: Optional[TagAnalysis]
    ) -> str:
        """Build a human-readable reason for why this tag was matched."""
        reason = f"Content analysis:\n{content_analysis.explanation}\n"

        if column_analysis is not None and column_analysis.explanation is not None:
            reason += f"Column analysis:\n{column_analysis.explanation}\n"

        return reason


class ScoreTagsForColumnService:
    _nlp_engine: "NlpEngine"

    def __init__(self, nlp_engine: Optional["NlpEngine"] = None):
        if nlp_engine is None:
            nlp_engine = load_nlp_engine()
        self._nlp_engine = nlp_engine

    def __call__(
        self, column: Column, data: Sequence[Any], tags_to_analyze: List[Tag]
    ) -> List[ScoredTag]:
        # Create analyzers for remaining candidate tags
        tag_analyzers = (
            TagAnalyzer(tag=tag, column=column, nlp_engine=self._nlp_engine)
            for tag in tags_to_analyze
        )

        # Score all tags
        classifier = TagScorer(tag_analyzers=tag_analyzers)
        column_name_str = (
            column.fullyQualifiedName.root if column.fullyQualifiedName else None
        )
        return classifier.predict_scores(
            sample_data=data,
            column_name=column_name_str,
            _column_data_type=column.dataType,
        )
