"""Unit tests for language support in auto-classification."""
import uuid
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.predefinedRecognizer import Name as PredefinedName
from metadata.generated.schema.type.predefinedRecognizer import PredefinedRecognizer
from metadata.generated.schema.type.recognizer import (
    Recognizer,
    RecognizerConfig,
    Target,
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


class TestLanguageBasedRecognizerSelection:
    """Test language-based recognizer selection with Spanish DNI example."""

    @pytest.fixture
    def sample_dni_data(self):
        return ["12345678Z", "87654321X", "11111111H"]

    @pytest.fixture
    def dni_column(self):
        return Column(
            name=ColumnName("dni_number"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="service.db.schema.table.dni_number",
        )

    @pytest.fixture
    def spanish_dni_tag(self):
        return Tag(
            id=uuid.uuid4(),
            name="DNI",
            fullyQualifiedName="Personal.DNI",
            description="Spanish DNI with Spanish language",
            autoClassificationEnabled=True,
            autoClassificationPriority=50,
            recognizers=[
                Recognizer(
                    name="ES_NIF_Spanish",
                    enabled=True,
                    target=Target.content,
                    recognizerConfig=RecognizerConfig(
                        root=PredefinedRecognizer(
                            type="predefined",
                            name=PredefinedName.EsNifRecognizer,
                            supportedLanguage=ClassificationLanguage.es,
                        )
                    ),
                )
            ],
        )

    @pytest.fixture
    def english_dni_tag(self):
        return Tag(
            id=uuid.uuid4(),
            name="SpanishID",
            fullyQualifiedName="Personal.SpanishID",
            description="Spanish DNI with English language",
            autoClassificationEnabled=True,
            autoClassificationPriority=50,
            recognizers=[
                Recognizer(
                    name="ES_NIF_English",
                    enabled=True,
                    target=Target.content,
                    recognizerConfig=RecognizerConfig(
                        root=PredefinedRecognizer(
                            type="predefined",
                            name=PredefinedName.EsNifRecognizer,
                            supportedLanguage=ClassificationLanguage.en,
                        )
                    ),
                )
            ],
        )

    def test_spanish_language_selects_spanish_dni_recognizer(
        self,
        dni_column,
        spanish_dni_tag,
        mock_nlp_engine,
    ):
        analyzer = TagAnalyzer(
            tag=spanish_dni_tag,
            column=dni_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.es,
        )

        recognizers = analyzer.content_recognizers
        assert len(recognizers) == 1
        assert recognizers[0].supported_language == "es"

    def test_english_language_filters_out_spanish_recognizer(
        self,
        dni_column,
        spanish_dni_tag,
        mock_nlp_engine,
    ):
        analyzer = TagAnalyzer(
            tag=spanish_dni_tag,
            column=dni_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.en,
        )

        recognizers = analyzer.content_recognizers
        assert (
            len(recognizers) == 0
        ), "Spanish-language recognizer should not be available for English analysis"

    def test_language_mismatch_returns_no_recognizers(
        self,
        dni_column,
        english_dni_tag,
        mock_nlp_engine,
    ):
        analyzer = TagAnalyzer(
            tag=english_dni_tag,
            column=dni_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.es,
        )

        recognizers = analyzer.content_recognizers
        assert (
            len(recognizers) == 0
        ), "English-language recognizer should not be available for Spanish analysis"

    def test_recognizer_language_filtering_in_analyzer(
        self, dni_column, spanish_dni_tag, mock_nlp_engine
    ):
        analyzer = TagAnalyzer(
            tag=spanish_dni_tag,
            column=dni_column,
            nlp_engine=mock_nlp_engine,
            language=ClassificationLanguage.es,
        )

        recognizers = analyzer.content_recognizers
        assert len(recognizers) == 1
        assert recognizers[0].supported_language == "es"


class TestLanguageModelMapping:
    """Test language to spaCy model mapping with defaultdict."""

    def test_supported_language_returns_specific_model(self):
        from metadata.pii.algorithms.presidio_utils import get_model_for_language

        model = get_model_for_language(ClassificationLanguage.es)
        assert model == "es_core_news_md"

    def test_unsupported_language_returns_multilang_model(self):
        from metadata.pii.algorithms.presidio_utils import get_model_for_language
        from metadata.pii.constants import SPACY_MULTILANG_MODEL

        model = get_model_for_language(ClassificationLanguage.ar)
        assert (
            model == SPACY_MULTILANG_MODEL
        ), f"Unsupported language should default to multilang model, got {model}"

    def test_english_returns_english_model(self):
        from metadata.pii.algorithms.presidio_utils import get_model_for_language

        model = get_model_for_language(ClassificationLanguage.en)
        assert model == "en_core_web_md"
