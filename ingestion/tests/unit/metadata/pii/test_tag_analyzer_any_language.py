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
from presidio_analyzer import Pattern, PatternRecognizer

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


def _make_any_language_tag(pii_classification):
    """Tag with an any-language pattern recognizer (email regex)."""
    pattern = PatternFactory.create(
        name="any-email-pattern",
        regex=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        score=0.8,
    )
    recognizer_config = PatternRecognizerFactory.create(
        patterns=[pattern],
        context=[],
        supportedLanguage=ClassificationLanguage.any,
    )
    rec = RecognizerFactory.create(
        name="any-email",
        recognizerConfig=recognizer_config,
        target=recognizer.Target.content,
    )
    return TagFactory.create(
        tag_name="AnyEmail",
        tag_classification=pii_classification,
        autoClassificationEnabled=True,
        recognizers=[rec],
    )


class TestGetRecognizersByAnyLanguage:
    def test_any_language_includes_all_recognizers(self, pii_classification, column, mock_nlp_engine):
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
            assert len(recs) == 1, f"Expected 1 recognizer for {tag.name}, got {len(recs)}"

    def test_specific_language_filters_out_other_languages(self, pii_classification, column, mock_nlp_engine):
        fr_tag = _make_fr_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=fr_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 0

    def test_specific_language_includes_matching_recognizer(self, pii_classification, column, mock_nlp_engine):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 1

    def test_en_agent_includes_any_language_recognizer(self, pii_classification, column, mock_nlp_engine):
        tag = _make_any_language_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        recognizers = analyzer.get_recognizers_by(recognizer.Target.content)
        assert len(recognizers) == 1

    def test_fr_agent_includes_any_language_recognizer(self, pii_classification, column, mock_nlp_engine):
        tag = _make_any_language_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.fr,
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

        def tracking_build(recs, nlp_engine=None, effective_language=None):
            build_calls.append((recs, nlp_engine))
            return original_build(recs, nlp_engine=nlp_engine, effective_language=effective_language)

        analyzer.build_analyzer_with = tracking_build

        result = analyzer.analyze(str_values=["john@example.com"])  # noqa: F841

        assert len(build_calls) == 1
        _, used_nlp_engine = build_calls[0]
        assert used_nlp_engine == HasAttributes(
            engine_name="spacy",
            models=Contains(IsDict(lang_code="en", model_name="en_core_web_md")),
        )

    def test_any_language_no_exception_raised(self, pii_classification, column, mock_nlp_engine):
        en_tag = _make_en_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=en_tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        result = analyzer.analyze(str_values=["test@example.com", "not-an-email"])
        assert result is not None
        assert result.score >= 0

    def test_any_language_empty_recognizers_returns_empty_analysis(self, pii_classification, column, mock_nlp_engine):
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
        result = analyzer.analyze(str_values=["some data"])
        assert result.score == 0
        assert result.recognizer_results == []

    def test_build_analyzer_with_raises_when_language_is_any_without_effective_language(
        self, pii_classification, column, mock_nlp_engine
    ):
        """build_analyzer_with must raise ValueError when the analyzer language is 'any'
        and no effective_language is provided, to prevent silent 'any' propagation to Presidio."""
        tag = _make_any_language_tag(pii_classification)
        analyzer = TagAnalyzer(
            tag=tag,
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.any,
        )
        with pytest.raises(ValueError, match="concrete language"):
            analyzer.build_analyzer_with([])

    def test_any_language_analyze_column_no_exception(self, pii_classification, column, mock_nlp_engine):
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
        result = analyzer.analyze(str_values=[], run_column_analysis=True)
        assert result is not None


class TestNormalizeRecognizerLanguage:
    """Unit tests for the _normalize_recognizer_language helper."""

    def test_any_language_replaced_by_effective_language(self, pii_classification, column, mock_nlp_engine):
        """A recognizer with supported_language='any' must be updated to the effective language."""
        analyzer = TagAnalyzer(
            tag=_make_any_language_tag(pii_classification),
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        rec = PatternRecognizer(
            supported_entity="EMAIL",
            supported_language="any",
            patterns=[Pattern(name="p", regex=r"@", score=0.5)],
        )
        result = analyzer._normalize_recognizer_language(rec, "en")
        assert result.supported_language == "en"

    def test_specific_language_not_changed(self, pii_classification, column, mock_nlp_engine):
        """A recognizer with an explicit language must not be overwritten."""
        analyzer = TagAnalyzer(
            tag=_make_en_tag(pii_classification),
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        rec = PatternRecognizer(
            supported_entity="EMAIL",
            supported_language="en",
            patterns=[Pattern(name="p", regex=r"@", score=0.5)],
        )
        result = analyzer._normalize_recognizer_language(rec, "fr")
        assert result.supported_language == "en"

    def test_original_not_mutated(self, pii_classification, column, mock_nlp_engine):
        """_normalize_recognizer_language must not mutate the original recognizer."""
        analyzer = TagAnalyzer(
            tag=_make_any_language_tag(pii_classification),
            column=column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )
        rec = PatternRecognizer(
            supported_entity="EMAIL",
            supported_language="any",
            patterns=[Pattern(name="p", regex=r"@", score=0.5)],
        )
        result = analyzer._normalize_recognizer_language(rec, "en")
        assert result.supported_language == "en"
        assert rec.supported_language == "any"


def _make_presidio_nlp_mock_for(language: str):
    """NLP mock for a specific language that satisfies AnalyzerEngine without real spaCy models."""
    nlp = MagicMock()
    nlp.is_loaded.return_value = True
    nlp.get_supported_languages.return_value = [language]
    return nlp


def _make_presidio_nlp_mock():
    """NLP mock that satisfies AnalyzerEngine without requiring real spaCy models.

    PatternRecognizers are regex-only and don't invoke the NLP engine, so this
    lightweight mock is sufficient to exercise the real Presidio registry/analysis
    path end-to-end.
    """
    return _make_presidio_nlp_mock_for("en")


class TestAnalyzeWithAnyLanguageRecognizerRealPresidia:
    """Regression tests: any-language pattern recognizers must fire through the real
    Presidio AnalyzerEngine when the agent is configured with a specific language.

    These tests use a real AnalyzerEngine (not a full mock) to catch the ValueError
    "No matching recognizers were found" that occurs when build_analyzer_with passes
    supported_languages=["any"] to Presidio and then calls analyze(language="en").
    """

    @pytest.fixture
    def any_language_email_tag(self, pii_classification):
        return _make_any_language_tag(pii_classification)

    def test_any_language_recognizer_does_not_raise_with_specific_language_agent(self, any_language_email_tag, column):
        """When agent language is 'en' and recognizer is 'any', analyze() must
        not raise ValueError from Presidio's registry."""
        nlp = _make_presidio_nlp_mock()
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=nlp,
            language=ClassificationLanguage.en,
        )
        result = analyzer.analyze(str_values=["user@example.com", "not-an-email"])
        assert result is not None

    def test_any_language_recognizer_matches_content_with_specific_language_agent(self, any_language_email_tag, column):
        """An any-language pattern recognizer must actually score > 0 when data matches."""
        nlp = _make_presidio_nlp_mock()
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=nlp,
            language=ClassificationLanguage.en,
        )
        result = analyzer.analyze(str_values=["user@example.com"])
        assert result.score > 0

    def test_any_language_recognizer_no_match_scores_zero(self, any_language_email_tag, column):
        """When data doesn't match, score must be 0 regardless of language."""
        nlp = _make_presidio_nlp_mock()
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=nlp,
            language=ClassificationLanguage.en,
        )
        result = analyzer.analyze(str_values=["no-match-here", "also-not-an-email"])
        assert result.score == 0

    def test_any_language_recognizer_with_fr_agent_does_not_raise(self, any_language_email_tag, column):
        """Agent=fr, Recognizer=any: must not raise; 'any' normalized to 'fr' before Presidio sees it."""
        nlp = _make_presidio_nlp_mock_for("fr")
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=nlp,
            language=ClassificationLanguage.fr,
        )
        result = analyzer.analyze(str_values=["user@example.com", "not-an-email"])
        assert result is not None

    def test_any_language_recognizer_matches_content_with_fr_agent(self, any_language_email_tag, column):
        """Agent=fr, Recognizer=any: pattern must still fire when data matches."""
        nlp = _make_presidio_nlp_mock_for("fr")
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=nlp,
            language=ClassificationLanguage.fr,
        )
        result = analyzer.analyze(str_values=["user@example.com"])
        assert result.score > 0

    def test_any_agent_with_any_recognizer_scores_on_match(self, any_language_email_tag, column):
        """Agent=any, Recognizer=any: 'any' group must be dispatched as 'en', not 'any'.

        If _analyze_with calls analyze(language='any') instead of 'en', Presidio raises
        ValueError because the recognizer is normalized to supported_language='en' but
        the registry finds no recognizer for 'any'.
        """
        analyzer = TagAnalyzer(
            tag=any_language_email_tag,
            column=column,
            nlp_engine=MagicMock(),
            language=ClassificationLanguage.any,
        )
        result = analyzer.analyze(str_values=["user@example.com"])
        assert result.score > 0
