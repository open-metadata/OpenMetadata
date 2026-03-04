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
from unittest.mock import Mock

import pytest
from dirty_equals import HasAttributes, IsFloat, IsInstance, IsNumeric
from presidio_analyzer.nlp_engine import NlpEngine

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
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.basic import EntityName
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.recognizer import RecognizerException, Target
from metadata.pii.algorithms.tag_scoring import TagScorer
from metadata.pii.models import ScoredTag
from metadata.pii.tag_analyzer import TagAnalysis, TagAnalyzer


class TestTagScorer:
    """Test the TagClassifier with TagAnalyzers"""

    @pytest.fixture
    def nlp_engine(self):
        """Create NLP engine for testing"""
        return Mock(spec=NlpEngine)

    @pytest.fixture
    def column_to_ignore(self) -> Column:
        return Column(
            name=ColumnName(root="ignore_column"),
            displayName="Ignore this column",
            dataType=DataType.STRING,
            fullyQualifiedName="test.table.ignore_column",
        )

    @pytest.fixture
    def column_to_analyze(self) -> Column:
        return Column(
            name=ColumnName(root="analyze_column"),
            displayName="Analyze this column",
            dataType=DataType.STRING,
            fullyQualifiedName="test.table.analyze_column",
        )

    @pytest.fixture
    def email_tag(
        self, column_to_ignore: Column, pii_classification: Classification
    ) -> Tag:
        """Create email tag for testing"""
        email_pattern = PatternFactory.create(
            name="Email pattern",
            regex="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            score=0.9,
        )
        email_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[email_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        email_recognizer = RecognizerFactory.create(
            name="EmailRecognizer",
            description="Recognizes email addresses",
            recognizerConfig=email_pattern_recognizer,
            confidenceThreshold=0.7,
            exceptionList=[
                RecognizerException(
                    entityLink="<#E::table::test.table::columns::ignore_column>",
                    reason="Not my style",
                )
            ],
            target=Target.content,
        )

        column_name_pattern = PatternFactory.create(
            name="Email pattern",
            regex="^email_address$",
            score=0.9,
        )
        column_name_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[column_name_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        column_name_recognizer = RecognizerFactory.create(
            name="EmailColumnNameRecognizer",
            description="Recognizes email address columns",
            recognizerConfig=column_name_pattern_recognizer,
            confidenceThreshold=0.7,
            exceptionList=[],
            target=Target.column_name,
        )

        return TagFactory.create(
            tag_name="EmailTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[email_recognizer, column_name_recognizer],
            description="Tag for email addresses",
        )

    @pytest.fixture
    def phone_tag(self, pii_classification: Classification) -> Tag:
        """Create phone tag for testing"""
        phone_pattern = PatternFactory.create(
            name="US Phone pattern",
            regex="\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b",
            score=0.85,
        )
        phone_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[phone_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        phone_recognizer = RecognizerFactory.create(
            name="PhoneRecognizer",
            description="Recognizes phone numbers",
            recognizerConfig=phone_pattern_recognizer,
            confidenceThreshold=0.6,
            exceptionList=[],
            target=Target.content,
        )

        return TagFactory.create(
            tag_name="PhoneTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[phone_recognizer],
            description="Tag for phone numbers",
        )

    @pytest.fixture
    def tag_analyzers(self, email_tag, phone_tag, column_to_analyze, nlp_engine):
        """Create tag analyzers for testing"""
        return [
            TagAnalyzer(tag=email_tag, column=column_to_analyze, nlp_engine=nlp_engine),
            TagAnalyzer(tag=phone_tag, column=column_to_analyze, nlp_engine=nlp_engine),
        ]

    @pytest.fixture
    def classifier(self, tag_analyzers):
        """Create a TagClassifier instance with tag analyzers"""
        return TagScorer(
            tag_analyzers=tag_analyzers,
            column_name_contribution=0.5,
            score_cutoff=0.1,
            relative_cardinality_cutoff=0.01,
        )

    def test_classify_email_with_tag_analyzer(self, classifier, email_tag):
        """Test classification with email data using TagAnalyzer"""
        sample_data = [
            "john.doe@example.com",
            "jane.smith@test.org",
            "bob@company.co.uk",
        ]

        scores = classifier.predict_scores(sample_data, column_name="customer_email")

        assert len(scores) == 1
        scored_tag = scores[0]

        # Should detect emails through tag analyzer
        assert scored_tag == IsInstance(ScoredTag) & HasAttributes(
            tag=IsInstance(Tag)
            & HasAttributes(
                name=EntityName(root="EmailTag"),
                fullyQualifiedName="PII.EmailTag",
            ),
            score=IsNumeric(gt=0.5),
        )

    def test_classify_phone_with_tag_analyzer(self, classifier, phone_tag):
        """Test classification with phone data using TagAnalyzer"""
        sample_data = ["555-123-4567", "555.987.6543", "5551234567"]

        scores = classifier.predict_scores(sample_data, column_name="contact_phone")

        assert len(scores) == 1
        scored_tag = scores[0]

        # Should detect emails through tag analyzer
        assert scored_tag == IsInstance(ScoredTag) & HasAttributes(
            tag=IsInstance(Tag)
            & HasAttributes(
                name=EntityName(root="PhoneTag"),
                fullyQualifiedName="PII.PhoneTag",
            ),
            score=IsNumeric(gt=0.5),
        )

    def test_empty_data_returns_empty(self, classifier):
        """Test that empty data returns empty scores"""
        scores = classifier.predict_scores([])
        assert scores == []

    def test_low_cardinality_returns_empty(self, classifier):
        """Test that low cardinality data returns empty scores"""
        sample_data = ["same_value"] * 100
        scores = classifier.predict_scores(sample_data)
        assert scores == []

    def test_mixed_data_detection(self, classifier):
        """Test detection of mixed PII types"""
        sample_data = [
            "Contact John at john@example.com",
            "Call Jane at 555-123-4567",
            "Email support@company.org or call 555.987.6543",
        ]

        scores = classifier.predict_scores(sample_data, column_name="contact_info")

        # Should detect patterns through tag analyzers
        assert len(scores) > 0

    def test_score_cutoff_filtering(self, tag_analyzers):
        """Test that scores below cutoff are filtered"""
        # Create a classifier with high cutoff
        high_cutoff_classifier = TagScorer(
            tag_analyzers=tag_analyzers,
            column_name_contribution=0.5,
            score_cutoff=0.95,  # Very high cutoff
            relative_cardinality_cutoff=0.01,
        )

        sample_data = ["maybe an email@somewhere", "could be phone 123456"]
        scored_tags = high_cutoff_classifier.predict_scores(
            sample_data, column_name="data"
        )

        # With such a high cutoff, weak matches should be filtered
        assert len(scored_tags) == 0 or all(
            scored_tag.score >= 0.95 for scored_tag in scored_tags
        )

    def test_column_name_contribution(self, classifier):
        """Test that column name contributes to score"""
        email_data = ["user1@domain.com", "user2@domain.org"]

        # First without column name match
        scores_without = classifier.predict_scores(
            email_data, column_name="random_field"
        )

        # Then with column name that matches email pattern
        scores_with = classifier.predict_scores(email_data, column_name="email_address")

        # Email tag should have higher score when column name matches
        if "PII.EmailTag" in scores_with and "PII.EmailTag" in scores_without:
            assert scores_with["PII.EmailTag"] >= scores_without["PII.EmailTag"]


class TestTagAnalyzer:
    """Test the TagAnalyzer class"""

    @pytest.fixture
    def nlp_engine(self):
        """Create NLP engine for testing"""
        return Mock(spec=NlpEngine)

    @pytest.fixture
    def column(self) -> Column:
        return Column(
            name=ColumnName(root="test_column"),
            displayName="Test Column",
            dataType=DataType.STRING,
            fullyQualifiedName="test.table.test_column",
        )

    @pytest.fixture
    def email_tag(self) -> Tag:
        """Create email tag for testing"""
        email_pattern = PatternFactory.create(
            name="Email pattern",
            regex="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            score=0.9,
        )
        email_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[email_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        email_recognizer = RecognizerFactory.create(
            name="EmailRecognizer",
            description="Recognizes email addresses",
            recognizerConfig=email_pattern_recognizer,
            confidenceThreshold=0.7,
            exceptionList=[],
            target=Target.content,
        )

        return TagFactory.create(
            tag_name="EmailTag",
            autoClassificationEnabled=True,
            recognizers=[email_recognizer],
            description="Tag for email addresses",
        )

    @pytest.fixture
    def tag_analyzer(self, email_tag, column, nlp_engine):
        """Create a TagAnalyzer instance"""
        return TagAnalyzer(tag=email_tag, column=column, nlp_engine=nlp_engine)

    def test_analyze_content_with_emails(self, tag_analyzer, email_tag: Tag):
        """Test content analysis with email data"""
        values = ["john@example.com", "jane@test.org", "bob@company.co.uk"]
        analysis = tag_analyzer.analyze_content(values)
        assert analysis == IsInstance(TagAnalysis) & HasAttributes(
            score=IsFloat(gt=0.8),
            tag=email_tag,
            explanation=(
                "Detected by `EmailRecognizer` 3 times with an average score of 0.90.\n"
                + "Patterns matched:\n"
                + "\t- `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}` (scored: 0.90)\n\n"
            ),
        )

    def test_analyze_content_no_match(self, tag_analyzer, email_tag: Tag):
        """Test content analysis with non-matching data"""
        values = ["random text", "no patterns here", "just words"]
        analysis = tag_analyzer.analyze_content(values)
        assert analysis == IsInstance(TagAnalysis) & HasAttributes(
            score=0.0,
            tag=email_tag,
            explanation=None,
        )

    def test_analyze_column_name(self, email_tag, nlp_engine):
        """Test column name analysis"""
        # Create column with email-related name
        column = Column(
            name=ColumnName(root="email_address"),
            displayName="Email Address",
            dataType=DataType.STRING,
            fullyQualifiedName="test.table.email_address",
        )

        # Add column name recognizer to tag
        column_name_pattern = PatternFactory.create(
            name="Email column pattern",
            regex=".*email.*",
            score=0.8,
        )
        column_name_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[column_name_pattern],
            regexFlags__ignoreCase=True,
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        column_name_recognizer = RecognizerFactory.create(
            name="EmailColumnRecognizer",
            description="Recognizes email columns",
            recognizerConfig=column_name_pattern_recognizer,
            confidenceThreshold=0.6,
            exceptionList=[],
            target=Target.column_name,
        )
        email_tag.recognizers.append(column_name_recognizer)

        analyzer = TagAnalyzer(tag=email_tag, column=column, nlp_engine=nlp_engine)
        analysis = analyzer.analyze_column()
        assert analysis == IsInstance(TagAnalysis) & HasAttributes(
            score=IsFloat(gt=0.5),
            tag=email_tag,
            explanation=(
                "Detected by `EmailColumnRecognizer` 1 time with an average score of 0.80.\n"
                + "Patterns matched:\n"
                + "\t- `.*email.*` (scored: 0.80)\n\n"
            ),
        )

    def test_get_recognizers_by_target(self, tag_analyzer, email_tag):
        """Test getting recognizers by target"""
        content_recognizers = tag_analyzer.get_recognizers_by(Target.content)
        assert len(content_recognizers) == 1

        column_recognizers = tag_analyzer.get_recognizers_by(Target.column_name)
        assert (
            len(column_recognizers) == 0
        )  # No column name recognizers in base fixture

    def test_disabled_auto_classification(self, column, nlp_engine):
        """Test that disabled auto-classification returns no recognizers"""
        test_pattern = PatternFactory.create(name="test", regex=".*", score=1.0)
        test_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[test_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        test_recognizer = RecognizerFactory.create(
            name="TestRecognizer",
            description="Should not be used",
            recognizerConfig=test_pattern_recognizer,
            target=Target.content,
        )

        tag = TagFactory.create(
            tag_name="DisabledTag",
            autoClassificationEnabled=False,
            recognizers=[test_recognizer],
            description="Tag with disabled auto-classification",
        )

        analyzer = TagAnalyzer(tag=tag, column=column, nlp_engine=nlp_engine)
        recognizers = analyzer.get_recognizers_by(Target.content)
        assert len(recognizers) == 0

    def test_exception_list_filtering(self, email_tag, nlp_engine):
        """Test that columns in exception list are filtered"""
        column = Column(
            name=ColumnName(root="ignored_column"),
            displayName="Ignored Column",
            dataType=DataType.STRING,
            fullyQualifiedName="test.table.ignored_column",
        )

        # Add column to exception list
        email_tag.recognizers[0].exceptionList = [
            RecognizerException(
                entityLink="<#E::table::test.table::columns::ignored_column>",
                reason="Test exception",
            )
        ]

        analyzer = TagAnalyzer(tag=email_tag, column=column, nlp_engine=nlp_engine)
        assert (
            analyzer.should_skip_recognizer(email_tag.recognizers[0].exceptionList)
            is True
        )
