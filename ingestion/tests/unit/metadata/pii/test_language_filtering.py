"""Unit tests for language support in auto-classification."""
import uuid
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.pii.algorithms.tag_scoring import ScoreTagsForColumnService
from metadata.pii.tag_analyzer import TagAnalysis, TagAnalyzer


@pytest.fixture
def mock_nlp_engine():
    """Create a mock NLP engine."""
    mock = Mock()
    mock.is_loaded.return_value = True
    mock.get_supported_languages.return_value = ["en"]
    return mock


@pytest.fixture
def sample_column():
    """Create a sample column for testing."""
    return Column(
        name=ColumnName("email_address"),
        dataType=DataType.VARCHAR,
        fullyQualifiedName="service.db.schema.table.email_address",
    )


@pytest.fixture
def sample_tag():
    """Create a sample tag with email recognizer."""
    return Tag(
        id=uuid.uuid4(),
        name="Email",
        fullyQualifiedName="PII.Email",
        description="Email tag",
        autoClassificationEnabled=True,
        recognizers=[],
    )


class TestTagAnalyzerLanguageConfiguration:
    """Test that TagAnalyzer correctly uses language parameter."""

    def test_language_initialization(self, sample_tag, sample_column, mock_nlp_engine):
        """Test TagAnalyzer initializes with specified language."""
        analyzer = TagAnalyzer(
            tag=sample_tag,
            column=sample_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.es,
        )

        assert analyzer._language == ClassificationLanguage.es

    def test_default_language(self, sample_tag, sample_column, mock_nlp_engine):
        """Test TagAnalyzer defaults to English when no language specified."""
        analyzer = TagAnalyzer(
            tag=sample_tag,
            column=sample_column,
            nlp_engine=mock_nlp_engine,
        )

        assert analyzer._language == ClassificationLanguage.en

    def test_analyzer_engine_supported_languages(
        self, sample_tag, sample_column, mock_nlp_engine
    ):
        """Test that AnalyzerEngine is created with correct supported language."""
        analyzer = TagAnalyzer(
            tag=sample_tag,
            column=sample_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.de,
        )

        engine = analyzer.build_analyzer_with([])
        assert engine.supported_languages == [ClassificationLanguage.en.value]


class TestScoreTagsForColumnServiceLanguage:
    """Test ScoreTagsForColumnService language handling."""

    def test_service_initialization_with_language(self, mock_nlp_engine):
        """Test ScoreTagsForColumnService initializes with language."""
        service = ScoreTagsForColumnService(
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.es,
        )

        assert service._language == ClassificationLanguage.es

    def test_service_default_language(self, mock_nlp_engine):
        """Test ScoreTagsForColumnService defaults to English."""
        service = ScoreTagsForColumnService(nlp_engine=mock_nlp_engine)

        assert service._language == ClassificationLanguage.en

    def test_service_passes_language_to_analyzer(
        self, mock_nlp_engine, sample_column, sample_tag
    ):
        """Test that service passes language to TagAnalyzer."""
        service = ScoreTagsForColumnService(
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.de,
        )

        with patch(
            "metadata.pii.algorithms.tag_scoring.TagAnalyzer"
        ) as mock_tag_analyzer_class:
            mock_analyzer_instance = Mock()
            mock_analyzer_instance.analyze_content.return_value = TagAnalysis(
                tag=sample_tag, score=0.5, explanation="test"
            )
            mock_analyzer_instance.analyze_column.return_value = TagAnalysis(
                tag=sample_tag, score=0.3, explanation="test"
            )
            mock_analyzer_instance.tag = sample_tag
            mock_tag_analyzer_class.return_value = mock_analyzer_instance

            service(
                column=sample_column,
                data=["test@example.com"],
                tags_to_analyze=[sample_tag],
            )

            mock_tag_analyzer_class.assert_called_once()
            call_kwargs = mock_tag_analyzer_class.call_args[1]
            assert call_kwargs["language"] == ClassificationLanguage.de
