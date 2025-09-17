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
import re
import uuid
from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import AnalyzerEngine, EntityRecognizer
from presidio_analyzer import PatternRecognizer as PresidioPatternRecognizer
from presidio_analyzer.nlp_engine import SpacyNlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.patternRecognizer import Pattern, PatternRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.pii.algorithms.presidio_utils import (
    TagRecognizers,
    build_analyzer_engine,
    get_recognizers_for_tag,
    load_nlp_engine,
)
from metadata.pii.algorithms.tags import PIITag
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
            models=[{"lang_code": SUPPORTED_LANG, "model": SPACY_EN_MODEL}]
        )
        assert result == mock_engine


class TestAnalyzerEngine:
    """Test analyzer engine building"""

    @patch("metadata.pii.algorithms.presidio_utils._get_all_pattern_recognizers")
    @patch("metadata.pii.algorithms.presidio_utils.load_nlp_engine")
    def test_build_analyzer_engine(self, mock_load_nlp, mock_get_recognizers):
        """Test building analyzer engine"""
        # Mock NLP engine
        mock_nlp_engine = Mock(spec=SpacyNlpEngine)
        mock_load_nlp.return_value = mock_nlp_engine

        # Mock recognizers
        mock_recognizer1 = Mock(spec=PresidioPatternRecognizer)
        mock_recognizer1.supported_language = "other"
        mock_recognizer2 = Mock(spec=PresidioPatternRecognizer)
        mock_recognizer2.supported_language = "other"
        mock_get_recognizers.return_value = [mock_recognizer1, mock_recognizer2]

        with patch(
            "metadata.pii.algorithms.presidio_utils.AnalyzerEngine"
        ) as mock_engine_cls:
            mock_engine = Mock(spec=AnalyzerEngine)
            mock_registry = Mock()
            mock_engine.registry = mock_registry
            mock_engine_cls.return_value = mock_engine

            result = build_analyzer_engine(SPACY_EN_MODEL)

            # Verify NLP engine was loaded
            mock_load_nlp.assert_called_once_with(
                model_name=SPACY_EN_MODEL, supported_language=SUPPORTED_LANG
            )

            # Verify analyzer engine was created
            mock_engine_cls.assert_called_once_with(
                nlp_engine=mock_nlp_engine, supported_languages=[SUPPORTED_LANG]
            )

            # Verify recognizers were added with correct language
            assert mock_recognizer1.supported_language == SUPPORTED_LANG
            assert mock_recognizer2.supported_language == SUPPORTED_LANG
            assert mock_registry.add_recognizer.call_count == 2

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


class TestTagRecognizers:
    """Test tag recognizer functions"""

    @pytest.fixture
    def tag(self) -> Tag:
        return Tag(
            id=uuid.uuid4(),
            name="Tag",
            fullyQualifiedName="Test.Tag",
            description="A test tag",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="Recognizer",
                    description="A test recognizer",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Example email",
                                    regex=".*@example.com$",
                                    score=0.7,
                                )
                            ],
                            supportedEntity=PIITag.EMAIL_ADDRESS.value,
                        ),
                    ),
                    confidenceThreshold=0.6,
                    exceptionList=[],
                )
            ],
        )

    @patch("metadata.pii.algorithms.presidio_utils.get_pii_column_name_patterns")
    def test_get_recognizers_for_tag(self, mock_patterns, tag: Tag) -> None:
        """Test getting recognizers for a tag"""
        # Mock column name patterns
        mock_patterns.return_value = {
            PIITag.PERSON: [
                {"name": "name_pattern", "regex": re.compile(".*name.*"), "score": 0.9}
            ],
            PIITag.EMAIL_ADDRESS: [
                {
                    "name": "email_pattern",
                    "regex": re.compile(".*email.*"),
                    "score": 0.9,
                }
            ],
        }

        result = get_recognizers_for_tag(tag)

        # Verify structure
        assert isinstance(result, dict)
        assert "content_recognizers" in result
        assert "column_recognizers" in result

        # Verify content recognizers
        assert len(result["content_recognizers"]) == 1
        content_recognizer = result["content_recognizers"][0]
        assert isinstance(content_recognizer, PresidioPatternRecognizer)
        assert content_recognizer.supported_entities == [PIITag.EMAIL_ADDRESS.value]

        # Verify column recognizers were created
        column_recognizers = result["column_recognizers"]
        assert len(column_recognizers) == 2  # One for each PIITag pattern

        # Check that PatternRecognizers were created
        for recognizer in column_recognizers:
            assert isinstance(recognizer, PresidioPatternRecognizer)
            assert recognizer.supported_language == SUPPORTED_LANG

    def test_tag_recognizers_type(self):
        """Test that TagRecognizers has the expected structure"""
        # Create a valid TagRecognizers dict
        mock_recognizer1 = Mock(spec=EntityRecognizer)
        mock_recognizer2 = Mock(spec=EntityRecognizer)

        tag_recognizers: TagRecognizers = {
            "content_recognizers": [mock_recognizer1],
            "column_recognizers": [mock_recognizer2],
        }

        # Verify keys and types
        assert "content_recognizers" in tag_recognizers
        assert "column_recognizers" in tag_recognizers
        assert isinstance(tag_recognizers["content_recognizers"], list)
        assert isinstance(tag_recognizers["column_recognizers"], list)
