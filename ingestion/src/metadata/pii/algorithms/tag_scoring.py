from typing import (  # noqa: UP035
    TYPE_CHECKING,
    Any,
    Dict,
    Iterable,
    List,
    Optional,
    Sequence,
    Set,
    Tuple,
    cast,
    final,
)

if TYPE_CHECKING:
    from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.predefinedRecognizer import PredefinedRecognizer
from metadata.generated.schema.type.tagLabelRecognizerMetadata import (
    PatternMatch,
    TagLabelRecognizerMetadata,
)
from metadata.pii.algorithms import presidio_constants
from metadata.pii.algorithms.preprocessing import preprocess_values
from metadata.pii.algorithms.presidio_utils import (
    load_nlp_engine,
    set_presidio_logger_level,
)
from metadata.pii.models import ScoredTag
from metadata.pii.tag_analyzer import TARGET_MAP, TagAnalysis, TagAnalyzer


@final
class TagScorer:
    """
    Tag classifier that returns ScoredTag objects with detailed match information.
    """

    def __init__(
        self,
        *,
        tag_analyzers: Iterable[TagAnalyzer],
        score_cutoff: float = 0.1,
        relative_cardinality_cutoff: float = 0.01,
    ):
        set_presidio_logger_level()

        self._analyzers = list(tag_analyzers)

        self._score_cutoff = score_cutoff
        self._relative_cardinality_cutoff = relative_cardinality_cutoff

    def predict_scores(
        self,
        sample_data: Sequence[Any],
        run_column_analysis: bool = False,
        _column_data_type: Optional[DataType] = None,  # noqa: UP045
    ) -> List[ScoredTag]:  # noqa: UP006
        str_values = preprocess_values(sample_data)

        unique_values = set(str_values)
        has_valid_content = bool(str_values) and (
            len(unique_values) / len(str_values) >= self._relative_cardinality_cutoff
        )

        if not has_valid_content and not run_column_analysis:
            return []

        results: List[ScoredTag] = []  # noqa: UP006
        for analyzer in self._analyzers:
            analysis = analyzer.analyze(
                str_values=str_values if has_valid_content else [],
                run_column_analysis=run_column_analysis,
            )

            if analysis.score > self._score_cutoff:
                recognizer_metadata = self._build_recognizer_metadata(analysis)

                results.append(
                    ScoredTag(
                        tag=analyzer.tag,
                        score=analysis.score,
                        reason=analysis.explanation or "",
                        recognizer_metadata=recognizer_metadata,
                        column_name_matched=analysis.column_name_matched,
                    )
                )

        return results

    def _build_recognizer_metadata(
        self,
        analysis: TagAnalysis,
    ) -> Optional[TagLabelRecognizerMetadata]:  # noqa: UP045
        if not analysis.recognizer_results:
            return None

        first_result = analysis.recognizer_results[0]
        recognition_metadata = cast(Dict[str, str], first_result.recognition_metadata)  # noqa: TC006, UP006

        recognizer_name = recognition_metadata.get(
            presidio_constants.RECOGNIZER_METADATA_NAME,
            recognition_metadata.get(
                presidio_constants.RECOGNIZER_METADATA_IDENTIFIER,
                presidio_constants.DEFAULT_RECOGNIZER_IDENTIFIER,
            ),
        )

        patterns_matched: Set[Tuple[str, str, float]] = set()  # noqa: UP006
        for result in analysis.recognizer_results:
            if result.analysis_explanation and result.analysis_explanation.pattern:
                patterns_matched.add(
                    (
                        result.analysis_explanation.pattern_name,
                        result.analysis_explanation.pattern,
                        result.analysis_explanation.score,
                    )
                )

        pattern_matches = [
            PatternMatch(name=name, regex=pattern, score=score)
            for name, pattern, score in sorted(patterns_matched, key=lambda o: o[1], reverse=True)
        ]

        recognizer_id = None
        for recognizer_config in analysis.tag.recognizers or []:
            if isinstance(recognizer_config.recognizerConfig.root, PredefinedRecognizer):
                name = recognizer_config.recognizerConfig.root.name.value
            else:
                name = recognizer_config.name.root

            if name == recognizer_name:
                recognizer_id = recognizer_config.id
                break

        if not recognizer_id:
            return None

        return TagLabelRecognizerMetadata(
            recognizerId=recognizer_id,
            recognizerName=recognizer_name,
            score=min(analysis.score, 1),
            target=TARGET_MAP[analysis.target] if analysis.target else None,
            patterns=pattern_matches if pattern_matches else None,
        )


class ScoreTagsForColumnService:
    _nlp_engine: "NlpEngine"
    _language: ClassificationLanguage

    def __init__(
        self,
        nlp_engine: Optional["NlpEngine"] = None,
        language: ClassificationLanguage = ClassificationLanguage.en,
    ):
        if nlp_engine is None:
            nlp_engine = load_nlp_engine()
        self._nlp_engine = nlp_engine
        self._language = language

    def __call__(self, column: Column, data: Sequence[Any], tags_to_analyze: List[Tag]) -> List[ScoredTag]:  # noqa: UP006
        # Create analyzers for remaining candidate tags
        tag_analyzers = (
            TagAnalyzer(
                tag=tag,
                column=column,
                nlp_engine=self._nlp_engine,
                language=self._language,
            )
            for tag in tags_to_analyze
        )

        classifier = TagScorer(tag_analyzers=tag_analyzers)
        return classifier.predict_scores(
            sample_data=data,
            run_column_analysis=column.fullyQualifiedName is not None,
            _column_data_type=column.dataType,
        )
