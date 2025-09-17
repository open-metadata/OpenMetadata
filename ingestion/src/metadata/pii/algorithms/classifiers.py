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
Classifier for PII detection and sensitivity tagging.
"""
from abc import ABC, abstractmethod
from collections import defaultdict
from typing import (
    Any,
    DefaultDict,
    Dict,
    Generic,
    Hashable,
    Mapping,
    Optional,
    Sequence,
    Set,
    TypeVar,
    final,
)

from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    RecognizerRegistry,
    RecognizerResult,
)
from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import DataType
from metadata.pii.algorithms.column_patterns import get_pii_column_name_patterns
from metadata.pii.algorithms.feature_extraction import (
    extract_pii_from_column_names,
    extract_pii_tags,
    is_non_pii_datatype,
    split_column_name,
)
from metadata.pii.algorithms.preprocessing import preprocess_values
from metadata.pii.algorithms.presidio_patches import (
    combine_patchers,
    date_time_patcher,
    url_patcher,
)
from metadata.pii.algorithms.presidio_utils import (
    TagRecognizers,
    build_analyzer_engine,
    get_recognizers_for_tag,
    load_nlp_engine,
    set_presidio_logger_level,
)
from metadata.pii.algorithms.tags import PIISensitivityTag, PIITag
from metadata.pii.constants import SUPPORTED_LANG

T = TypeVar("T", bound=Hashable)


class ColumnClassifier(ABC, Generic[T]):
    """
    Base class for column classifiers.
    This class defines the interface for classifiers that predict the class
    of a column based on its data and metadata.
    """

    @abstractmethod
    def predict_scores(
        self,
        sample_data: Sequence[Any],
        column_name: Optional[str] = None,
        column_data_type: Optional[DataType] = None,
    ) -> Mapping[T, float]:
        """
        Predict the scores for the given column and sample data of the column.
        The scores are a mapping of class labels to their respective scores:
        higher scores indicate a higher likelihood of the class for the given inputs.
        """


@final
class HeuristicPIIClassifier(ColumnClassifier[PIITag]):
    """
    Heuristic PII Column Classifier
    """

    def __init__(
        self,
        *,
        column_name_contribution: float = 0.5,
        score_cutoff: float = 0.1,
        relative_cardinality_cutoff: float = 0.01,
    ):
        set_presidio_logger_level()
        self._presidio_analyzer: AnalyzerEngine = build_analyzer_engine()
        self._column_name_patterns = get_pii_column_name_patterns()

        self._column_name_contribution = column_name_contribution
        self._score_cutoff = score_cutoff
        self._relative_cardinality_cutoff = relative_cardinality_cutoff

    def predict_scores(
        self,
        sample_data: Sequence[Any],
        column_name: Optional[str] = None,
        column_data_type: Optional[DataType] = None,
    ) -> Mapping[PIITag, float]:
        if column_data_type is not None and is_non_pii_datatype(column_data_type):
            return {}

        str_values = preprocess_values(sample_data)

        if not str_values:
            return {}

        # Relative cardinality test
        unique_values = set(str_values)

        if len(unique_values) / len(str_values) < self._relative_cardinality_cutoff:
            return {}
        context = split_column_name(column_name) if column_name else None

        content_results = extract_pii_tags(
            self._presidio_analyzer,
            str_values,
            context=context,
            recognizer_result_patcher=combine_patchers(date_time_patcher, url_patcher),
        )

        column_name_matches: Set[PIITag] = set()

        if column_name is not None:
            column_name_matches = extract_pii_from_column_names(
                column_name, patterns=self._column_name_patterns
            )

        final_results: Dict[PIITag, float] = {}

        for tag, score in content_results.items():
            final_score = score
            if tag in column_name_matches:
                final_score += self._column_name_contribution
            # Apply the score cutoff
            if final_score >= self._score_cutoff:
                final_results[tag] = final_score

        return final_results


class PIISensitiveClassifier(ColumnClassifier[PIISensitivityTag]):
    """
    Implements a classifier for PII sensitivity tags based on a given
    PII column classifier. If no classifier is provided, it defaults to
    using the HeuristicPIIColumnClassifier.
    """

    def __init__(self, classifier: Optional[ColumnClassifier[PIITag]] = None):
        self.classifier: ColumnClassifier[PIITag] = (
            classifier or HeuristicPIIClassifier()
        )

    def predict_scores(
        self,
        sample_data: Sequence[Any],
        column_name: Optional[str] = None,
        column_data_type: Optional[DataType] = None,
    ) -> Mapping[PIISensitivityTag, float]:
        pii_tags = self.classifier.predict_scores(
            sample_data, column_name, column_data_type
        )
        results: DefaultDict[PIISensitivityTag, float] = defaultdict(float)
        counts: DefaultDict[PIISensitivityTag, int] = defaultdict(int)

        for tag, score in pii_tags.items():
            # Convert PIITag to PIISensitivityTag
            pii_sensitivity = tag.sensitivity()
            results[pii_sensitivity] += score
            counts[pii_sensitivity] += 1

        # Normalize the scores
        for tag in results:
            if counts[tag] > 0:
                results[tag] /= counts[tag]

        return results


@final
class TagClassifier(ColumnClassifier[str]):
    """
    Heuristic PII Column Classifier
    """

    def __init__(
        self,
        *,
        available_tags: list[Tag],
        column_name_contribution: float = 0.5,
        score_cutoff: float = 0.1,
        relative_cardinality_cutoff: float = 0.01,
        nlp_engine: Optional[NlpEngine] = None,
    ):
        set_presidio_logger_level()

        self._available_tags = available_tags
        self._tags_to_recognizers: dict[str, TagRecognizers] = {
            tag.fullyQualifiedName: get_recognizers_for_tag(tag)
            for tag in self._available_tags
        }
        self._nlp_engine = nlp_engine or load_nlp_engine()

        self._column_name_contribution = column_name_contribution
        self._score_cutoff = score_cutoff
        self._relative_cardinality_cutoff = relative_cardinality_cutoff

    def content_recognizers_for(self, tag: Tag) -> list[EntityRecognizer]:
        return self._tags_to_recognizers[tag.fullyQualifiedName]["content_recognizers"]

    def column_recognizers_for(self, tag: Tag) -> list[EntityRecognizer]:
        return self._tags_to_recognizers[tag.fullyQualifiedName]["column_recognizers"]

    def build_analyzer_with(
        self, recognizers: list[EntityRecognizer]
    ) -> AnalyzerEngine:
        recognizer_registry = RecognizerRegistry(recognizers=recognizers)
        return AnalyzerEngine(
            registry=recognizer_registry,
            nlp_engine=self._nlp_engine,
            supported_languages=[SUPPORTED_LANG],
        )

    def analyze_content(
        self, column_name: Optional[str], values: Sequence[str], tag: Tag
    ) -> float:
        context = split_column_name(column_name) if column_name else None
        analyzer = self.build_analyzer_with(self.content_recognizers_for(tag))

        results: list[RecognizerResult] = []
        for value in values:
            results.extend(
                analyzer.analyze(value, language=SUPPORTED_LANG, context=context)
            )

        if not results:
            return 0.0

        score = sum(r.score for r in results) / len(results)
        return max(0.0, score)

    def analyze_column(self, column_name: str, tag: Tag) -> float:
        analyzer = self.build_analyzer_with(self.column_recognizers_for(tag))
        results = analyzer.analyze(column_name, language=SUPPORTED_LANG)

        if not results:
            return 0.0

        score = sum(r.score for r in results) / len(results)
        return max(0.0, score)

    def predict_scores(
        self,
        sample_data: Sequence[Any],
        column_name: Optional[str] = None,
        column_data_type: Optional[DataType] = None,
    ) -> Mapping[str, float]:
        str_values = preprocess_values(sample_data)

        if not str_values:
            return {}

        # Relative cardinality test
        unique_values = set(str_values)
        if len(unique_values) / len(str_values) < self._relative_cardinality_cutoff:
            return {}

        results: dict[str, float] = defaultdict(float)
        for tag in self._available_tags:
            content_score = self.analyze_content(
                column_name=column_name,
                values=str_values,
                tag=tag,
            )
            column_score = 0.0
            if column_name is not None:
                column_score = self.analyze_column(
                    column_name=column_name,
                    tag=tag,
                )
                column_score *= max(column_score, self._column_name_contribution)

            total_score = content_score + column_score
            if total_score > self._score_cutoff:
                results[tag.fullyQualifiedName] = content_score + column_score

        return results
