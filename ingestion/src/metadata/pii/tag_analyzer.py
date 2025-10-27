from typing import Sequence, final

from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    RecognizerRegistry,
    RecognizerResult,
)
from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type.recognizer import RecognizerException, Target
from metadata.pii.algorithms.feature_extraction import split_column_name
from metadata.pii.algorithms.presidio_recognizer_factory import (
    PresidioRecognizerFactory,
)
from metadata.pii.constants import SUPPORTED_LANG
from metadata.utils.entity_link import (
    get_entity_link,  # pyright: ignore[reportUnknownVariableType]
)
from metadata.utils.fqn import FQN_SEPARATOR


@final
class TagAnalyzer:
    """An adapter that allows easy obtention of presidio EntityRecognizers from Tag's configuration"""

    tag: Tag

    def __init__(self, tag: Tag, column: Column, nlp_engine: NlpEngine):
        self.tag = tag
        self._column = column
        self._nlp_engine = nlp_engine

    def should_skip_recognizer(self, exception_list: list[RecognizerException]):
        blacklisted_entities = {ex.entityLink.root for ex in exception_list}

        (
            *table_fqn_parts,
            column_name,
        ) = self._column.fullyQualifiedName.root.split(  # pyright: ignore[reportOptionalMemberAccess]
            FQN_SEPARATOR
        )
        return (
            get_entity_link(
                Table, FQN_SEPARATOR.join(table_fqn_parts), column_name=column_name
            )
            in blacklisted_entities
        )

    def get_recognizers_by(self, target: Target) -> list[EntityRecognizer]:
        if self.tag.autoClassificationEnabled is False:
            return []

        recognizers: list[EntityRecognizer] = []

        for recognizer in self.tag.recognizers or []:
            if recognizer.target is not target or self.should_skip_recognizer(
                recognizer.exceptionList or []
            ):
                continue

            created = PresidioRecognizerFactory.create_recognizer(recognizer)
            if created is not None:
                recognizers.append(created)

        return recognizers

    @property
    def content_recognizers(self) -> list[EntityRecognizer]:
        return self.get_recognizers_by(Target.content)

    @property
    def column_recognizers(self) -> list[EntityRecognizer]:
        return self.get_recognizers_by(Target.column_name)

    @property
    def _column_name(self) -> str:
        return self._column.name.root

    def build_analyzer_with(
        self, recognizers: list[EntityRecognizer]
    ) -> AnalyzerEngine:
        recognizer_registry = RecognizerRegistry(recognizers=recognizers)
        return AnalyzerEngine(
            registry=recognizer_registry,
            nlp_engine=self._nlp_engine,
            supported_languages=[SUPPORTED_LANG],
        )

    def analyze_content(self, values: Sequence[str]) -> float:
        recognizers = self.content_recognizers

        if not recognizers:
            return 0.0

        context = split_column_name(self._column_name)
        analyzer = self.build_analyzer_with(recognizers)

        results: list[RecognizerResult] = []
        for value in values:
            results.extend(
                analyzer.analyze(value, language=SUPPORTED_LANG, context=context)
            )

        if not results:
            return 0.0

        return sum(r.score for r in results) / len(results)

    def analyze_column(self) -> float:
        recognizers = self.column_recognizers

        if not recognizers:
            return 0.0

        analyzer = self.build_analyzer_with(recognizers)
        results = analyzer.analyze(self._column_name, language=SUPPORTED_LANG)

        if not results:
            return 0.0

        return sum(r.score for r in results) / len(results)
