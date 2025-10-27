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
from unittest.mock import Mock

import pytest
from presidio_analyzer.nlp_engine import NlpEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.type.patternRecognizer import PatternRecognizer
from metadata.generated.schema.type.piiEntity import PIIEntity
from metadata.generated.schema.type.recognizer import (
    Recognizer,
    RecognizerConfig,
    RecognizerException,
    Target,
)
from metadata.generated.schema.type.recognizers.patterns import Pattern
from metadata.generated.schema.type.recognizers.regexFlags import RegexFlags
from metadata.pii.algorithms.classifiers import TagClassifier
from metadata.pii.tag_analyzer import TagAnalyzer


class TestTagClassifier:
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
    def email_tag(self, column_to_ignore: Column) -> Tag:
        """Create email tag for testing"""
        return Tag(
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
                            supportedEntity=PIIEntity.EMAIL_ADDRESS,
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage="en",
                        ),
                    ),
                    confidenceThreshold=0.7,
                    exceptionList=[
                        RecognizerException(
                            entityLink="<#E::table::test.table::columns::ignore_column>",
                            reason="Not my style",
                        )
                    ],
                    target=Target.content,
                ),
                Recognizer(
                    id=uuid.uuid4(),
                    name="EmailColumnNameRecognizer",
                    description="Recognizes email address columns",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Email pattern",
                                    regex="^email_address$",
                                    score=0.9,
                                )
                            ],
                            supportedEntity=PIIEntity.EMAIL_ADDRESS,
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage="en",
                        ),
                    ),
                    confidenceThreshold=0.7,
                    exceptionList=[],
                    target=Target.column_name,
                ),
            ],
        )

    @pytest.fixture
    def phone_tag(self) -> Tag:
        """Create phone tag for testing"""
        return Tag(
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
                            supportedEntity=PIIEntity.PHONE_NUMBER,
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage="en",
                        ),
                    ),
                    confidenceThreshold=0.6,
                    exceptionList=[],
                    target=Target.content,
                )
            ],
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
        return TagClassifier(
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

        # Should detect emails through tag analyzer
        assert "PII.EmailTag" in scores
        assert scores["PII.EmailTag"] > 0.5

    def test_classify_phone_with_tag_analyzer(self, classifier, phone_tag):
        """Test classification with phone data using TagAnalyzer"""
        sample_data = ["555-123-4567", "555.987.6543", "5551234567"]

        scores = classifier.predict_scores(sample_data, column_name="contact_phone")

        # Should detect phones through tag analyzer
        assert "PII.PhoneTag" in scores
        assert scores["PII.PhoneTag"] > 0.5

    def test_empty_data_returns_empty(self, classifier):
        """Test that empty data returns empty scores"""
        scores = classifier.predict_scores([])
        assert scores == {}

    def test_low_cardinality_returns_empty(self, classifier):
        """Test that low cardinality data returns empty scores"""
        sample_data = ["same_value"] * 100
        scores = classifier.predict_scores(sample_data)
        assert scores == {}

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
        high_cutoff_classifier = TagClassifier(
            tag_analyzers=tag_analyzers,
            column_name_contribution=0.5,
            score_cutoff=0.95,  # Very high cutoff
            relative_cardinality_cutoff=0.01,
        )

        sample_data = ["maybe an email@somewhere", "could be phone 123456"]
        scores = high_cutoff_classifier.predict_scores(sample_data, column_name="data")

        # With such a high cutoff, weak matches should be filtered
        assert len(scores) == 0 or all(score >= 0.95 for score in scores.values())

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
        return Tag(
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
                            supportedEntity=PIIEntity.EMAIL_ADDRESS,
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage="en",
                        ),
                    ),
                    confidenceThreshold=0.7,
                    exceptionList=[],
                    target=Target.content,
                )
            ],
        )

    @pytest.fixture
    def tag_analyzer(self, email_tag, column, nlp_engine):
        """Create a TagAnalyzer instance"""
        return TagAnalyzer(tag=email_tag, column=column, nlp_engine=nlp_engine)

    def test_analyze_content_with_emails(self, tag_analyzer):
        """Test content analysis with email data"""
        values = ["john@example.com", "jane@test.org", "bob@company.co.uk"]
        score = tag_analyzer.analyze_content(values)
        assert score > 0.8

    def test_analyze_content_no_match(self, tag_analyzer):
        """Test content analysis with non-matching data"""
        values = ["random text", "no patterns here", "just words"]
        score = tag_analyzer.analyze_content(values)
        assert score == 0.0

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
        email_tag.recognizers.append(
            Recognizer(
                id=uuid.uuid4(),
                name="EmailColumnRecognizer",
                description="Recognizes email columns",
                recognizerConfig=RecognizerConfig(
                    root=PatternRecognizer(
                        type="pattern",
                        patterns=[
                            Pattern(
                                name="Email column pattern",
                                regex=".*email.*",
                                score=0.8,
                            )
                        ],
                        supportedEntity=PIIEntity.EMAIL_ADDRESS,
                        regexFlags=RegexFlags(ignoreCase=True),
                        context=[],
                        supportedLanguage="en",
                    ),
                ),
                confidenceThreshold=0.6,
                exceptionList=[],
                target=Target.column_name,
            )
        )

        analyzer = TagAnalyzer(tag=email_tag, column=column, nlp_engine=nlp_engine)
        score = analyzer.analyze_column()
        assert score > 0.5

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
        tag = Tag(
            id=uuid.uuid4(),
            name="DisabledTag",
            fullyQualifiedName="Test.DisabledTag",
            description="Tag with disabled auto-classification",
            autoClassificationEnabled=False,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="TestRecognizer",
                    description="Should not be used",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[Pattern(name="test", regex=".*", score=1.0)],
                            supportedEntity=PIIEntity.EMAIL_ADDRESS,
                            regexFlags=RegexFlags(),
                            context=[],
                            supportedLanguage="en",
                        ),
                    ),
                    target=Target.content,
                )
            ],
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
