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
from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import EntityRecognizer, RecognizerResult
from presidio_analyzer.nlp_engine import NlpArtifacts

from metadata.pii.algorithms.presidio_utils import (
    apply_confidence_threshold,
    build_analyzer_engine,
    load_nlp_engine,
    set_presidio_logger_level,
)
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG


def test_analyzer_supports_all_expected_pii_entities():
    """
    Here we check that the analyzer can potentially detect all our PII entities.
    """
    set_presidio_logger_level()
    analyzer = build_analyzer_engine()

    entities = set(PIITag.values())
    supported_entities = set(analyzer.get_supported_entities(SUPPORTED_LANG))
    assert entities <= supported_entities, (
        f"Analyzer does not support all expected PII entities. "
        f"{entities - supported_entities}"
    )


class TestApplyConfidenceThreshold:
    """Test the apply_confidence_threshold function"""

    @pytest.fixture
    def mock_recognizer(self):
        """Create a mock EntityRecognizer"""
        recognizer = Mock(spec=EntityRecognizer)
        recognizer.name = "test_recognizer"
        recognizer.supported_entities = ["TEST_ENTITY"]
        return recognizer

    def test_filters_results_below_threshold(self, mock_recognizer):
        """Test that results below threshold are filtered out"""
        # Create mock results with varying confidence scores
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.9),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.5),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.3),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        # Apply threshold of 0.6
        threshold = 0.6
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        # Test the decorated analyze method
        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze(
            "test text", ["TEST_ENTITY"], nlp_artifacts
        )

        # Should only return results with score >= 0.6
        assert len(results) == 1
        assert results[0].score == 0.9

    def test_returns_all_results_above_threshold(self, mock_recognizer):
        """Test that all results above threshold are kept"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.8),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.7),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.9),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.65
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze(
            "test text", ["TEST_ENTITY"], nlp_artifacts
        )

        # All results should be above threshold
        assert len(results) == 3
        assert all(r.score >= threshold for r in results)

    def test_returns_empty_list_when_no_results_pass_threshold(self, mock_recognizer):
        """Test that empty list is returned when no results pass threshold"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.3),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.2),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.5
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze(
            "test text", ["TEST_ENTITY"], nlp_artifacts
        )

        assert len(results) == 0

    def test_threshold_of_zero_returns_all_results(self, mock_recognizer):
        """Test that threshold of 0 returns all results"""
        mock_results = [
            RecognizerResult(entity_type="TEST_ENTITY", start=0, end=5, score=0.1),
            RecognizerResult(entity_type="TEST_ENTITY", start=10, end=15, score=0.01),
            RecognizerResult(entity_type="TEST_ENTITY", start=20, end=25, score=0.001),
        ]

        mock_recognizer.analyze = Mock(return_value=mock_results)

        threshold = 0.0
        decorator = apply_confidence_threshold(threshold)
        decorated_recognizer = decorator(mock_recognizer)

        nlp_artifacts = Mock(spec=NlpArtifacts)
        results = decorated_recognizer.analyze(
            "test text", ["TEST_ENTITY"], nlp_artifacts
        )

        assert len(results) == 3


@patch("metadata.pii.algorithms.presidio_utils._load_spacy_model")
@patch("metadata.pii.algorithms.presidio_utils.SpacyNlpEngine")
class TestLoadNlpEngine:
    @staticmethod
    def setup_method():
        """Clear the cache before each test"""
        load_nlp_engine.cache_clear()

    @staticmethod
    def teardown_method():
        """Clear the cache after each test"""
        load_nlp_engine.cache_clear()

    def test_returns_same_instance_for_same_parameters(
        self, mock_spacy_engine_class, mock_load_spacy
    ):
        """Test that calling load_nlp_engine with same parameters returns same instance"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")

        assert engine1 is engine2
        assert mock_spacy_engine_class.call_count == 1
        assert mock_load_spacy.call_count == 1

    def test_returns_different_instances_for_different_model_names(
        self, mock_spacy_engine_class, mock_load_spacy
    ):
        """Test that different model names result in different instances"""
        mock_engine1 = Mock()
        mock_engine2 = Mock()
        mock_spacy_engine_class.side_effect = [mock_engine1, mock_engine2]

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_md", supported_language="en")

        assert engine1 is not engine2
        assert mock_spacy_engine_class.call_count == 2
        assert mock_load_spacy.call_count == 2

    def test_returns_different_instances_for_different_languages(
        self, mock_spacy_engine_class, mock_load_spacy
    ):
        """Test that different languages result in different instances"""
        mock_engine1 = Mock()
        mock_engine2 = Mock()
        mock_spacy_engine_class.side_effect = [mock_engine1, mock_engine2]

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="fr")

        assert engine1 is not engine2
        assert mock_spacy_engine_class.call_count == 2

    def test_cache_persists_across_multiple_calls(
        self, mock_spacy_engine_class, mock_load_spacy
    ):
        """Test that cache works correctly across multiple calls"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine2 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")
        engine3 = load_nlp_engine(model_name="en_core_web_sm", supported_language="en")

        assert engine1 is engine2 is engine3
        assert mock_spacy_engine_class.call_count == 1
        assert mock_load_spacy.call_count == 1

    def test_uses_default_parameters_when_not_provided(
        self, mock_spacy_engine_class, mock_load_spacy
    ):
        """Test that default parameters work correctly with caching"""
        mock_engine = Mock()
        mock_spacy_engine_class.return_value = mock_engine

        engine1 = load_nlp_engine()
        engine2 = load_nlp_engine()

        assert engine1 is engine2
        assert mock_spacy_engine_class.call_count == 1
