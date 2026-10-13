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
Unit tests for Presidio utilities
"""

from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry, RecognizerResult
from presidio_analyzer.nlp_engine import NlpArtifacts, SpacyNlpEngine

from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.algorithms.feature_extraction import split_column_name
from metadata.pii.algorithms.presidio_utils import (
    ContextAwareUsBankRecognizer,
    build_analyzer_engine,
    context_matches,
    load_nlp_engine,
)
from metadata.pii.constants import SPACY_EN_MODEL, SUPPORTED_LANG


@pytest.mark.parametrize(
    ("configured_context", "column_name", "expected"),
    [
        ("first name", "first_name", True),
        ("first name", "firstName", True),
        ("first name", "customer_first_name_text", True),
        ("account number", "bank_account_number", True),
        ("first name", "first_namespace", False),
        ("first name", "prefirst_name", False),
        ("first name", "first_nameplate", False),
        ("first name", "first_middle_name", False),
        ("first name", "name_first", False),
        ("cid", "acid_level", False),
        ("firstname", "firstname", True),
        ("first name", "firstname", False),
        ("prénom usuel", "prénom_usuel", True),
        (" first name ", "user_first_name_value", True),
        ("(first name)", "user(first_name)value", True),
    ],
)
def test_context_matches_complete_column_terms(configured_context: str, column_name: str, expected: bool) -> None:
    assert context_matches([configured_context], split_column_name(column_name)) is expected


@pytest.mark.parametrize(
    ("configured_context", "column_context", "expected"),
    [
        ("", ["ordinary", "column"], True),
        ("()", ["user()value"], True),
        ("()", ["user", "value"], False),
    ],
)
def test_context_matches_existing_literal_edge_cases(
    configured_context: str, column_context: list[str], expected: bool
) -> None:
    assert context_matches([configured_context], column_context) is expected


@pytest.mark.parametrize(
    ("column_name", "expected_score"),
    [("customer_account_number", 1.0), ("customer_account_numbering", 0.05)],
)
def test_bank_context_enhancement_requires_complete_phrase(column_name: str, expected_score: float) -> None:
    recognizer = ContextAwareUsBankRecognizer(context=["account number"])
    result = RecognizerResult(
        entity_type="US_BANK_NUMBER",
        start=0,
        end=10,
        score=0.05,
        recognition_metadata={},
    )

    enhanced = recognizer.enhance_using_context(
        text="1234567890",
        raw_recognizer_results=[result],
        other_raw_recognizer_results=[],
        nlp_artifacts=Mock(spec=NlpArtifacts),
        context=split_column_name(column_name),
    )

    assert enhanced[0].score == expected_score


class TestSpacyModelLoading:
    """Test spacy model loading functions"""

    @patch("metadata.pii.algorithms.presidio_utils._load_spacy_model")
    @patch("metadata.pii.algorithms.presidio_utils.SpacyNlpEngine")
    def test_load_nlp_engine(self, mock_nlp_engine_cls, mock_load_spacy):
        """Test loading NLP engine"""
        mock_engine = Mock(spec=SpacyNlpEngine)
        mock_nlp_engine_cls.return_value = mock_engine

        result = load_nlp_engine(SPACY_EN_MODEL, SUPPORTED_LANG)

        mock_load_spacy.assert_called_once_with(SPACY_EN_MODEL)
        mock_nlp_engine_cls.assert_called_once_with(
            models=[{"lang_code": SUPPORTED_LANG, "model_name": SPACY_EN_MODEL}]
        )
        assert result == mock_engine


class TestAnalyzerEngine:
    """Test analyzer engine building"""

    @patch("metadata.pii.algorithms.presidio_utils.AnalyzerEngine")
    @patch("metadata.pii.algorithms.presidio_utils.RecognizerRegistry")
    @patch("metadata.pii.algorithms.presidio_utils._get_all_pattern_recognizers")
    @patch("metadata.pii.algorithms.presidio_utils.load_nlp_engine")
    def test_build_analyzer_engine(
        self,
        mock_load_nlp,
        mock_get_recognizers,
        mock_recognizer_registry_cls,
        mock_engine_cls,
    ):
        """Test building analyzer engine"""
        # Mock NLP engine
        mock_nlp_engine = Mock(spec=SpacyNlpEngine)
        mock_load_nlp.return_value = mock_nlp_engine

        mock_registry = Mock(spec=RecognizerRegistry)
        mock_recognizer_registry_cls.return_value = mock_registry

        mock_engine = Mock(spec=AnalyzerEngine)
        mock_engine_cls.return_value = mock_engine

        result = build_analyzer_engine(ClassificationLanguage.en)

        # Verify NLP engine was loaded
        mock_load_nlp.assert_called_once_with(model_name="en_core_web_md", supported_language=SUPPORTED_LANG)

        # Verify analyzer engine was created
        mock_engine_cls.assert_called_once_with(
            nlp_engine=mock_nlp_engine,
            supported_languages=[SUPPORTED_LANG],
            registry=mock_registry,
        )

        assert result == mock_engine

    @patch("metadata.pii.algorithms.presidio_utils._get_all_pattern_recognizers")
    @patch("metadata.pii.algorithms.presidio_utils.load_nlp_engine")
    def test_build_analyzer_engine_default_model(self, mock_load_nlp, mock_get_recognizers):
        """Test building analyzer engine with default model"""
        mock_nlp_engine = Mock(spec=SpacyNlpEngine)
        mock_load_nlp.return_value = mock_nlp_engine
        mock_get_recognizers.return_value = []

        with patch("metadata.pii.algorithms.presidio_utils.AnalyzerEngine") as mock_engine_cls:
            mock_engine = Mock(spec=AnalyzerEngine)
            mock_engine.registry = Mock()
            mock_engine_cls.return_value = mock_engine

            result = build_analyzer_engine()  # noqa: F841

            mock_load_nlp.assert_called_once_with(model_name=SPACY_EN_MODEL, supported_language=SUPPORTED_LANG)
