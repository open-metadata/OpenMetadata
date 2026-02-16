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
Unit tests for TagAnalyzer "any language" mode.
"""
from unittest.mock import MagicMock

import pytest
from dirty_equals import Contains, HasAttributes, IsDict

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    PatternFactory,
    PatternRecognizerFactory,
    RecognizerFactory,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type import recognizer
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.tag_analyzer import TagAnalyzer


@pytest.fixture
def pii_classification() -> Classification:
    return ClassificationFactory.create(
        fqn="PII",
        mutuallyExclusive=True,
        autoClassificationConfig__enabled=True,
        autoClassificationConfig__minimumConfidence=0.5,
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_confidence,
        autoClassificationConfig__requireExplicitMatch=True,
    )


@pytest.fixture
def column() -> Column:
    return Column(
        name=ColumnName(root="email_address"),
        dataType=DataType.VARCHAR,
        fullyQualifiedName="service.db.schema.table.email_address",
    )


@pytest.fixture
def mock_nlp_engine():
    return MagicMock()


def _make_en_tag(pii_classification):
    """Tag with an English pattern recognizer."""
    en_pattern = PatternFactory.create(
        name="en-email-pattern",
        regex=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        score=0.8,
    )
    en_recognizer_config = PatternRecognizerFactory.create(
        patterns=[en_pattern],
        context=[],
        supportedLanguage=ClassificationLanguage.en,
    )
    en_recognizer = RecognizerFactory.create(
        name="en-email",
        recognizerConfig=en_recognizer_config,
        target=recognizer.Target.content,
    )
    return TagFactory.create(
        tag_name="EnEmail",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        recognizers=[en_recognizer],
    )


def _make_fr_tag(pii_classification):
    """Tag with a French pattern recognizer."""
    fr_pattern = PatternFactory.create(
        name="fr-phone-pattern",
        regex=r"0[1-9](\s?\d{2}){4}",
        score=0.8,
    )
    fr_recognizer_config = PatternRecognizerFactory.create(
        patterns=[fr_pattern],
        context=[],
        supportedLanguage=ClassificationLanguage.fr,
    )
    fr_recognizer = RecognizerFactory.create(
        name="fr-phone",
        recognizerConfig=fr_recognizer_config,
        target=recognizer.Target.content,
    )
    return TagFactory.create(
        tag_name="FrPhone",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        recognizers=[fr_recognizer],
    )


class TestGetRecognizersByAnyLanguage:
    def test_any_language_includes_all_recognizers(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 1

    def test_any_language_includes_recognizers_of_different_languages(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_tag = _make_en_tag(pii_classification)
        fr_tag = _make_fr_tag(pii_classification)

        for tag in [en_tag, fr_tag]:
            tag_analyzer = TagAnalyzer(
                tag=tag,
                column=column,
                nlp_engine=mock_nlp_engine,
                language=ClassificationLanguage.any,
            )
            recs = tag_analyzer.get_recognizers_by(recognizer.Target.content)
            assert (
                len(recs) == 1
            ), f"Expected 1 recognizer for {tag.name}, got {len(recs)}"

    def test_specific_language_filters_out_other_languages(
        self, pii_classification, column, mock_nlp_engine
    ):
        fr_tag = _make_fr_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=fr_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 0

    def test_specific_language_includes_matching_recognizer(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 1


class TestAnalyzeWithAnyLanguage:
    def test_any_language_content_analysis_dispatches_per_language_group(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )

        build_calls = []
        original_build = analyzer.build_analyzer_with

        def tracking_build(recs, nlp_engine=None):
            build_calls.append((recs, nlp_engine))
            return original_build(recs, nlp_engine=nlp_engine)

        analyzer.build_analyzer_with = tracking_build

        result = analyzer.analyze_content(["john@example.com"])

        assert len(build_calls) == 1
        _, used_nlp_engine = build_calls[0]
        assert used_nlp_engine == HasAttributes(
            engine_name="spacy",
            models=Contains(IsDict(lang_code="en", model_name="en_core_web_md")),
        )

    def test_any_language_no_exception_raised(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        result = analyzer.analyze_content(["test@example.com", "not-an-email"])
        assert result is not None
        assert result.score >= 0

    def test_any_language_empty_recognizers_returns_empty_analysis(
        self, pii_classification, column, mock_nlp_engine
    ):
        tag = TagFactory.create(
            tag_name="EmptyTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=None,
        )
        analyzer = TagAnalyzer(
            tag=tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        result = analyzer.analyze_content(["some data"])
        assert result.score == 0
        assert result.recognizer_results == []

    def test_any_language_analyze_column_no_exception(
        self, pii_classification, column, mock_nlp_engine
    ):
        en_pattern = PatternFactory.create(
            name="column-pattern",
            regex=r"email",
            score=0.9,
        )
        en_recognizer_config = PatternRecognizerFactory.create(
            patterns=[en_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        en_recognizer = RecognizerFactory.create(
            name="column-recognizer",
            recognizerConfig=en_recognizer_config,
            target=recognizer.Target.column_name,
        )
        tag = TagFactory.create(
            tag_name="ColumnTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[en_recognizer],
        )
        analyzer = TagAnalyzer(
            tag=tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        result = analyzer.analyze_column()
        assert result is not None
