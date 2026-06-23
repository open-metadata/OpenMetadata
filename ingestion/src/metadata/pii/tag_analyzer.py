from itertools import groupby
from typing import List, Optional, Sequence, Union, final

from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    RecognizerRegistry,
    RecognizerResult,
)
from presidio_analyzer.nlp_engine import NlpEngine
from pydantic import BaseModel

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.type import recognizer, tagLabelRecognizerMetadata
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.recognizer import RecognizerException
from metadata.pii.algorithms.feature_extraction import split_column_name
from metadata.pii.algorithms.presidio_recognizer_factory import (
    PresidioRecognizerFactory,
)
from metadata.pii.algorithms.presidio_utils import (
    explain_recognition_results,
    load_nlp_engine,
)
from metadata.utils.entity_link import (
    get_entity_link,  # pyright: ignore[reportUnknownVariableType]
)
from metadata.utils.fqn import FQN_SEPARATOR

TARGET_MAP = {
    recognizer.Target.content: tagLabelRecognizerMetadata.Target.content,
    recognizer.Target.column_name: tagLabelRecognizerMetadata.Target.column_name,
}


class TagAnalysis(BaseModel):
    tag: Tag
    score: float
    explanation: Optional[str]
    recognizer_results: List[RecognizerResult] = []
    target: Optional[recognizer.Target] = None

    @final
    class Config:
        arbitrary_types_allowed = True


@final
class TagAnalyzer:
    """An adapter that allows easy obtention of presidio EntityRecognizers from Tag's configuration"""

    tag: Tag

    def __init__(
        self,
        tag: Tag,
        column: Column,
        nlp_engine: NlpEngine,
        language: ClassificationLanguage = ClassificationLanguage.en,
    ):
        self.tag = tag
        self._column = column
        self._nlp_engine = nlp_engine
        self._language = language

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

    def _supports_language(self, created: EntityRecognizer) -> bool:
        return (
            self._language is ClassificationLanguage.any
            or created.supported_language
            in {
                ClassificationLanguage.any.value,
                self._language.value,
            }
        )

    def get_recognizers_by(self, target: recognizer.Target) -> list[EntityRecognizer]:
        if self.tag.autoClassificationEnabled is False:
            return []

        recognizers: list[EntityRecognizer] = []

        for recognizer in self.tag.recognizers or []:
            if (
                recognizer.target is not target
                or recognizer.enabled is False
                or self.should_skip_recognizer(recognizer.exceptionList or [])
            ):
                continue

            created = PresidioRecognizerFactory.create_recognizer(recognizer)
            if created is not None and self._supports_language(created):
                recognizers.append(created)

        return recognizers

    @property
    def content_recognizers(self) -> list[EntityRecognizer]:
        return self.get_recognizers_by(recognizer.Target.content)

    @property
    def column_recognizers(self) -> list[EntityRecognizer]:
        return self.get_recognizers_by(recognizer.Target.column_name)

    @property
    def _column_name(self) -> str:
        return self._column.name.root

    def build_analyzer_with(
        self,
        recognizers: list[EntityRecognizer],
        nlp_engine: Optional[NlpEngine] = None,
    ) -> AnalyzerEngine:
        supported_languages = [rec.supported_language for rec in recognizers]
        recognizer_registry = RecognizerRegistry(
            recognizers=recognizers, supported_languages=supported_languages
        )
        effective_nlp = nlp_engine if nlp_engine is not None else self._nlp_engine
        return AnalyzerEngine(
            registry=recognizer_registry,
            nlp_engine=effective_nlp,
            supported_languages=supported_languages,
        )

    def _analyze_with(
        self,
        text_or_values: Union[str, Sequence[str]],
        recognizers: list[EntityRecognizer],
        context: Optional[list[str]] = None,
    ) -> list[RecognizerResult]:
        values = (
            [text_or_values]
            if isinstance(text_or_values, str)
            else list(text_or_values)
        )
        results: list[RecognizerResult] = []

        if self._language is not ClassificationLanguage.any:
            analyzer = self.build_analyzer_with(recognizers)
            for value in values:
                results.extend(
                    analyzer.analyze(
                        value,
                        language=self._language.value,
                        context=context,
                        return_decision_process=True,
                    )
                )
            return results

        sorted_recs = sorted(recognizers, key=lambda r: r.supported_language)
        for lang, group in groupby(sorted_recs, key=lambda r: r.supported_language):
            lang_recognizers = list(group)
            analyzer = self.build_analyzer_with(
                lang_recognizers,
                nlp_engine=load_nlp_engine(
                    classification_language=ClassificationLanguage(lang)
                ),
            )
            for value in values:
                results.extend(
                    analyzer.analyze(
                        value,
                        language=lang,
                        context=context,
                        return_decision_process=True,
                    )
                )
        return results

    def analyze(
        self,
        str_values: Sequence[str],
        run_column_analysis: bool = False,
    ) -> TagAnalysis:
        content_results: list[RecognizerResult] = []
        content_score = 0.0
        if str_values:
            content_recognizers = self.content_recognizers
            if content_recognizers:
                context = split_column_name(self._column_name)
                content_results = self._analyze_with(
                    str_values, content_recognizers, context=context
                )
                content_score = min(
                    sum(r.score for r in content_results) / len(str_values), 1.0
                )

        column_results: list[RecognizerResult] = []
        column_score = 0.0
        if run_column_analysis:
            column_recognizers = self.column_recognizers
            if column_recognizers:
                column_results = self._analyze_with(
                    self._column_name, column_recognizers
                )
                column_score = min(sum(r.score for r in column_results), 1.0)

        column_wins = column_score >= content_score and bool(column_results)
        score = max(content_score, column_score)
        target = (
            recognizer.Target.column_name if column_wins else recognizer.Target.content
        )
        winning_results = column_results if column_wins else content_results
        all_results = (
            (column_results + content_results)
            if column_wins
            else (content_results + column_results)
        )

        return TagAnalysis(
            tag=self.tag,
            score=score,
            explanation=explain_recognition_results(all_results)
            if all_results
            else None,
            recognizer_results=winning_results,
            target=target if winning_results else None,
        )

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} tag={self.tag.fullyQualifiedName}>"
