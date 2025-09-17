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
Unit tests for PII classifiers
"""
import uuid
from unittest.mock import Mock, patch

import pytest
from presidio_analyzer import AnalyzerEngine
from presidio_analyzer import PatternRecognizer as PresidioPatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.type.patternRecognizer import Pattern, PatternRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.pii.algorithms.classifiers import TagClassifier
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.constants import SUPPORTED_LANG


class TestTagClassifier:
    """Test the TagClassifier"""

    @pytest.fixture
    def tags(self):
        """Create actual Tag objects for testing"""
        tag1 = Tag(
            id=uuid.uuid4(),
            name="EmailTag",
            fullyQualifiedName="PII.EmailTag",
            description="Tag for email addresses",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="EmailRecognizer",
                    description="Recognizes email addresses",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Email pattern",
                                    regex="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
                                    score=0.9,
                                )
                            ],
                            supportedEntity=PIITag.EMAIL_ADDRESS.value,
                        ),
                    ),
                    confidenceThreshold=0.7,
                    exceptionList=[],
                )
            ],
        )

        tag2 = Tag(
            id=uuid.uuid4(),
            name="PhoneTag",
            fullyQualifiedName="PII.PhoneTag",
            description="Tag for phone numbers",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="PhoneRecognizer",
                    description="Recognizes phone numbers",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="US Phone pattern",
                                    regex="\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
                                    score=0.85,
                                )
                            ],
                            supportedEntity=PIITag.PHONE_NUMBER.value,
                        ),
                    ),
                    confidenceThreshold=0.6,
                    exceptionList=[],
                )
            ],
        )

        return [tag1, tag2]

    @pytest.fixture
    def nlp_engine(self):
        """Create a mock NLP engine"""
        return Mock(spec=NlpEngine)

    @pytest.fixture
    def classifier(self, tags, nlp_engine):
        """Create a TagClassifier instance with actual tags"""
        with patch("metadata.pii.algorithms.classifiers.set_presidio_logger_level"):
            with patch(
                "metadata.pii.algorithms.classifiers.load_nlp_engine",
                return_value=nlp_engine,
            ):
                return TagClassifier(
                    available_tags=tags,
                    column_name_contribution=0.5,
                    score_cutoff=0.1,
                    relative_cardinality_cutoff=0.01,
                    nlp_engine=nlp_engine,
                )

    def test_initialization(self, classifier, tags):
        """Test that classifier is properly initialized"""
        assert len(classifier._available_tags) == 2
        assert len(classifier._tags_to_recognizers) == 2

    def test_content_recognizers_for(self, classifier, tags):
        """Test getting content recognizers for a tag"""
        recognizers = classifier.content_recognizers_for(tags[0])
        assert isinstance(recognizers, list)
        assert len(recognizers) == 1
        assert isinstance(recognizers[0], PresidioPatternRecognizer)
        assert recognizers[0].supported_entities == [PIITag.EMAIL_ADDRESS.value]

    def test_column_recognizers_for(self, classifier, tags):
        """Test getting column recognizers for a tag"""
        recognizers = classifier.column_recognizers_for(tags[0])
        assert isinstance(recognizers, list)
        # Column recognizers are created from PII patterns
        assert all(isinstance(r, PresidioPatternRecognizer) for r in recognizers)

    def test_build_analyzer_with(self, classifier, tags):
        """Test building analyzer with specific recognizers"""
        # Get actual recognizers for a tag
        recognizers = classifier.content_recognizers_for(tags[0])

        analyzer = classifier.build_analyzer_with(recognizers)

        assert isinstance(analyzer, AnalyzerEngine)
        assert analyzer.supported_languages == [SUPPORTED_LANG]

    def test_analyze_content_with_email(self, classifier, tags):
        """Test content analysis with actual email data"""
        values = ["john.doe@example.com", "jane.smith@test.org", "bob@company.co.uk"]

        score = classifier.analyze_content(
            column_name="customer_email", values=values, tag=tags[0]  # Email tag
        )

        # Should detect emails with high confidence
        assert score > 0.8

    def test_analyze_content_with_phone(self, classifier, tags):
        """Test content analysis with actual phone data"""
        values = ["555-123-4567", "555.987.6543", "5551234567"]

        score = classifier.analyze_content(
            column_name="contact_phone", values=values, tag=tags[1]  # Phone tag
        )

        # Should detect phones with good confidence
        assert score > 0.7

    def test_analyze_content_no_match(self, classifier, tags):
        """Test content analysis with non-matching data"""
        values = ["random text", "no patterns here", "just some words"]

        score = classifier.analyze_content(
            column_name="description", values=values, tag=tags[0]  # Email tag
        )

        assert score == 0.0

    def test_analyze_column_with_email_column_name(self, classifier, tags):
        """Test column name analysis with email-related name"""
        score = classifier.analyze_column("customer_email", tags[0])

        # Should have some score from column name pattern matching
        assert score >= 0.0

    def test_predict_scores_empty_data(self, classifier):
        """Test prediction with empty data"""
        scores = classifier.predict_scores([])
        assert scores == {}

    def test_predict_scores_low_cardinality(self, classifier):
        """Test prediction with low cardinality data"""
        sample_data = ["same_value"] * 100
        scores = classifier.predict_scores(sample_data)
        assert scores == {}

    def test_predict_scores_with_mixed_data(self, classifier, tags):
        """Test prediction with data containing multiple PII types"""
        sample_data = [
            "Contact John at john@example.com",
            "Call Jane at 555-123-4567",
            "Email support@company.org or call 555.987.6543",
        ]

        scores = classifier.predict_scores(sample_data, column_name="contact_info")

        # Should detect both email and phone patterns
        assert len(scores) > 0
        assert any(tag.fullyQualifiedName in scores for tag in tags)

    def test_predict_scores_respects_cutoff(self, classifier, tags):
        """Test that scores below cutoff are filtered"""
        # Create a classifier with high cutoff
        with patch("metadata.pii.algorithms.classifiers.set_presidio_logger_level"):
            with patch(
                "metadata.pii.algorithms.classifiers.load_nlp_engine",
                return_value=classifier._nlp_engine,
            ):
                high_cutoff_classifier = TagClassifier(
                    available_tags=tags,
                    column_name_contribution=0.5,
                    score_cutoff=0.95,  # Very high cutoff
                    relative_cardinality_cutoff=0.01,
                    nlp_engine=classifier._nlp_engine,
                )

        sample_data = ["maybe an email@somewhere", "could be phone 123456"]

        scores = high_cutoff_classifier.predict_scores(sample_data, column_name="data")

        # With such a high cutoff, weak matches should be filtered
        # This depends on actual scoring, but weak patterns should not pass
        assert len(scores) == 0 or all(score >= 0.95 for score in scores.values())

    def test_predict_scores_with_column_name_boost(self, classifier, tags):
        """Test that column name provides score boost"""
        email_data = ["user1@domain.com", "user2@domain.org"]

        # First without column name match
        scores_without = classifier.predict_scores(
            email_data, column_name="random_field"
        )

        # Then with column name that matches email pattern
        scores_with = classifier.predict_scores(email_data, column_name="email_address")

        # The email tag should have higher score when column name matches
        email_tag = tags[0]
        assert email_tag.fullyQualifiedName in scores_without
        assert email_tag.fullyQualifiedName in scores_with

        assert (
            scores_with[email_tag.fullyQualifiedName]
            > scores_without[email_tag.fullyQualifiedName]
        )
