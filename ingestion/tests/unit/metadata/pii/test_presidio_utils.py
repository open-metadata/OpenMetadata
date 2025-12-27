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

from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import SpacyNlpEngine

from metadata.pii.algorithms.presidio_utils import (
    build_analyzer_engine,
    load_nlp_engine,
)
from metadata.pii.constants import SPACY_EN_MODEL, SUPPORTED_LANG


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

        result = build_analyzer_engine(SPACY_EN_MODEL)

        # Verify NLP engine was loaded
        mock_load_nlp.assert_called_once_with(
            model_name=SPACY_EN_MODEL, supported_language=SUPPORTED_LANG
        )

        # Verify analyzer engine was created
        mock_engine_cls.assert_called_once_with(
            nlp_engine=mock_nlp_engine,
            supported_languages=[SUPPORTED_LANG],
            registry=mock_registry,
        )

        assert result == mock_engine

    @patch("metadata.pii.algorithms.presidio_utils._get_all_pattern_recognizers")
    @patch("metadata.pii.algorithms.presidio_utils.load_nlp_engine")
    def test_build_analyzer_engine_default_model(
        self, mock_load_nlp, mock_get_recognizers
    ):
        """Test building analyzer engine with default model"""
        mock_nlp_engine = Mock(spec=SpacyNlpEngine)
        mock_load_nlp.return_value = mock_nlp_engine
        mock_get_recognizers.return_value = []

        with patch(
            "metadata.pii.algorithms.presidio_utils.AnalyzerEngine"
        ) as mock_engine_cls:
            mock_engine = Mock(spec=AnalyzerEngine)
            mock_engine.registry = Mock()
            mock_engine_cls.return_value = mock_engine

            result = build_analyzer_engine()

            mock_load_nlp.assert_called_once_with(
                model_name=SPACY_EN_MODEL, supported_language=SUPPORTED_LANG
            )
