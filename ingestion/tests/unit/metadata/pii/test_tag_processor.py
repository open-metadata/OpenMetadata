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
Unit tests for Tag Processor
"""
import uuid
from unittest.mock import Mock, patch

import pytest

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.patternRecognizer import Pattern, PatternRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.classifiers import TagClassifier
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.tag_processor import TagProcessor


class TestTagProcessor:
    """Test the TagProcessor class"""

    @pytest.fixture
    def workflow_config(self):
        """Create workflow configuration"""
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="test_token"),
        )

        return OpenMetadataWorkflowConfig(
            source=Source(
                type="mysql",
                serviceName="test",
                sourceConfig=SourceConfig(
                    config=DatabaseServiceAutoClassificationPipeline(
                        confidence=85,
                        enableAutoClassification=True,
                    )
                ),
            ),
            workflowConfig=WorkflowConfig(openMetadataServerConfig=server_config),
        )

    @pytest.fixture
    def pii_sensitive_email_tag(self):
        """Create a PII.Sensitive tag for email addresses using Presidio"""
        return Tag(
            id=uuid.uuid4(),
            name="Sensitive",
            fullyQualifiedName="PII.Sensitive",
            description="PII sensitive data - includes emails, names, SSNs",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="EmailRecognizer",
                    description="Presidio recognizer for email addresses",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Email pattern",
                                    regex="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
                                    score=0.95,
                                )
                            ],
                            supportedEntity=PIITag.EMAIL_ADDRESS.value,
                        ),
                    ),
                    confidenceThreshold=0.8,
                    exceptionList=[],
                ),
                Recognizer(
                    id=uuid.uuid4(),
                    name="PersonRecognizer",
                    description="Presidio recognizer for person names",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Name pattern",
                                    regex="\\b[A-Z][a-z]+ [A-Z][a-z]+\\b",
                                    score=0.85,
                                )
                            ],
                            supportedEntity=PIITag.PERSON.value,
                        ),
                    ),
                    confidenceThreshold=0.75,
                    exceptionList=[],
                ),
            ],
        )

    @pytest.fixture
    def pii_nonsensitive_date_tag(self):
        """Create a PII.NonSensitive tag for dates using Presidio"""
        return Tag(
            id=uuid.uuid4(),
            name="NonSensitive",
            fullyQualifiedName="PII.NonSensitive",
            description="PII non-sensitive data - includes dates, ages",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="DateRecognizer",
                    description="Presidio recognizer for dates",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Date pattern",
                                    regex="\\b\\d{4}-\\d{2}-\\d{2}\\b",
                                    score=0.8,
                                )
                            ],
                            supportedEntity=PIITag.DATE_TIME.value,
                        ),
                    ),
                    confidenceThreshold=0.7,
                    exceptionList=[],
                )
            ],
        )

    @pytest.fixture
    def pii_highly_sensitive_ssn_tag(self):
        """Create a PII.HighlySensitive tag for SSN and credit cards using Presidio"""
        return Tag(
            id=uuid.uuid4(),
            name="HighlySensitive",
            fullyQualifiedName="PII.HighlySensitive",
            description="Highly sensitive PII data - SSN, credit cards, medical records",
            autoClassificationEnabled=True,
            recognizers=[
                Recognizer(
                    id=uuid.uuid4(),
                    name="SSNRecognizer",
                    description="Presidio recognizer for SSN",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="SSN pattern",
                                    regex="\\b\\d{3}-\\d{2}-\\d{4}\\b",
                                    score=0.98,
                                )
                            ],
                            supportedEntity="US_SSN",
                        ),
                    ),
                    confidenceThreshold=0.9,
                    exceptionList=[],
                ),
                Recognizer(
                    id=uuid.uuid4(),
                    name="CreditCardRecognizer",
                    description="Presidio recognizer for credit card numbers",
                    recognizerConfig=RecognizerConfig(
                        root=PatternRecognizer(
                            type="pattern",
                            patterns=[
                                Pattern(
                                    name="Credit card pattern",
                                    regex="\\b(?:\\d[ -]*?){13,16}\\b",
                                    score=0.95,
                                )
                            ],
                            supportedEntity="CREDIT_CARD",
                        ),
                    ),
                    confidenceThreshold=0.85,
                    exceptionList=[],
                ),
            ],
        )

    @pytest.fixture
    def mock_metadata(self):
        """Create mock metadata client"""
        return Mock(spec=OpenMetadata)

    @pytest.fixture
    def processor(self, workflow_config, mock_metadata):
        """Create TagProcessor instance"""
        with patch("metadata.pii.tag_processor.OpenMetadata"):
            return TagProcessor(config=workflow_config, metadata=mock_metadata)

    def test_initialization(self, processor):
        """Test TagProcessor initialization"""
        assert processor.name == "Tag Classification Processor"
        assert processor.confidence_threshold == 0.85
        assert processor._tolerance == 0.01

    def test_build_tag_label(self, pii_sensitive_email_tag):
        """Test building a tag label from a PII tag"""
        tag_label = TagProcessor.build_tag_label(
            pii_sensitive_email_tag.fullyQualifiedName
        )

        assert isinstance(tag_label, TagLabel)
        assert tag_label.tagFQN.root == "PII.Sensitive"
        assert tag_label.source is TagSource.Classification
        assert tag_label.state is State.Suggested
        assert tag_label.labelType is LabelType.Generated

    def test_skip_column_with_existing_pii_tag(
        self, processor, mock_metadata, pii_sensitive_email_tag
    ):
        """Test that columns with existing PII tags are skipped"""
        # Create column with existing PII tag
        column = Column(
            name=ColumnName("customer_email"),
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN=pii_sensitive_email_tag.fullyQualifiedName,
                    state=State.Confirmed,
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                )
            ],
        )

        sample_data = ["john@example.com", "jane@test.com", "bob@domain.org"]

        # Should return empty list because PII tag exists
        result = processor.create_column_tag_labels(column, sample_data)
        assert result == []

        # Metadata list_all_entities should not be called
        mock_metadata.list_all_entities.assert_not_called()

    def test_classify_email_column_as_pii_sensitive(
        self,
        processor,
        mock_metadata,
        pii_sensitive_email_tag,
        pii_nonsensitive_date_tag,
    ):
        """Test classifying an email column as PII.Sensitive using Presidio"""
        # Create column without tags - typical email column
        column = Column(
            name=ColumnName("customer_email"),
            dataType=DataType.VARCHAR,
        )

        # Real email data that Presidio would recognize
        sample_data = [
            "john.doe@example.com",
            "jane.smith@company.org",
            "bob.wilson@test.net",
        ]

        # Mock metadata to return available PII tags
        mock_metadata.list_all_entities.return_value = [
            pii_sensitive_email_tag,
            pii_nonsensitive_date_tag,
        ]

        result = processor.create_column_tag_labels(column, sample_data)

        # Verify result - should tag as PII.Sensitive
        assert len(result) == 1
        assert isinstance(result[0], TagLabel)
        assert result[0].tagFQN.root == "PII.Sensitive"
        assert result[0].state is State.Suggested
        assert result[0].labelType is LabelType.Generated

    def test_classify_ssn_column_as_highly_sensitive(
        self,
        processor,
        mock_metadata,
        pii_highly_sensitive_ssn_tag,
        pii_sensitive_email_tag,
    ):
        """Test classifying SSN column as PII.HighlySensitive using Presidio"""
        column = Column(
            name=ColumnName("social_security_number"),
            dataType=DataType.VARCHAR,
        )

        # Real SSN pattern data
        sample_data = ["123-45-6789", "987-65-4321", "555-12-3456"]

        mock_metadata.list_all_entities.return_value = [
            pii_highly_sensitive_ssn_tag,
            pii_sensitive_email_tag,
        ]

        with patch("metadata.pii.tag_processor.TagClassifier") as mock_classifier_cls:
            mock_classifier = Mock(spec=TagClassifier)
            mock_classifier_cls.return_value = mock_classifier

            # SSN should score very high for HighlySensitive
            mock_classifier.predict_scores.return_value = {
                pii_highly_sensitive_ssn_tag.fullyQualifiedName: 0.98,
                pii_sensitive_email_tag.fullyQualifiedName: 0.05,
            }

            with patch("metadata.pii.tag_processor.normalize_scores") as mock_normalize:
                mock_normalize.return_value = {
                    pii_highly_sensitive_ssn_tag.fullyQualifiedName: 0.98,
                    pii_sensitive_email_tag.fullyQualifiedName: 0.05,
                }

                with patch(
                    "metadata.pii.tag_processor.get_top_classes"
                ) as mock_get_top:
                    mock_get_top.return_value = [
                        pii_highly_sensitive_ssn_tag.fullyQualifiedName
                    ]

                    result = processor.create_column_tag_labels(column, sample_data)

                    assert len(result) == 1
                    assert result[0].tagFQN.root == "PII.HighlySensitive"

    def test_classify_date_column_as_nonsensitive(
        self,
        processor,
        mock_metadata,
        pii_nonsensitive_date_tag,
        pii_sensitive_email_tag,
    ):
        """Test classifying date column as PII.NonSensitive using Presidio"""
        column = Column(
            name=ColumnName("birth_date"),
            dataType=DataType.DATE,
        )

        sample_data = ["2023-01-15", "2022-12-25", "2021-07-04"]

        mock_metadata.list_all_entities.return_value = [
            pii_nonsensitive_date_tag,
            pii_sensitive_email_tag,
        ]

        with patch("metadata.pii.tag_processor.TagClassifier") as mock_classifier_cls:
            mock_classifier = Mock(spec=TagClassifier)
            mock_classifier_cls.return_value = mock_classifier

            # Date patterns should match NonSensitive
            mock_classifier.predict_scores.return_value = {
                pii_nonsensitive_date_tag.fullyQualifiedName: 0.88,
                pii_sensitive_email_tag.fullyQualifiedName: 0.02,
            }

            with patch("metadata.pii.tag_processor.normalize_scores") as mock_normalize:
                mock_normalize.return_value = {
                    pii_nonsensitive_date_tag.fullyQualifiedName: 0.88,
                    pii_sensitive_email_tag.fullyQualifiedName: 0.02,
                }

                with patch(
                    "metadata.pii.tag_processor.get_top_classes"
                ) as mock_get_top:
                    mock_get_top.return_value = [
                        pii_nonsensitive_date_tag.fullyQualifiedName
                    ]

                    result = processor.create_column_tag_labels(column, sample_data)

                    assert len(result) == 1
                    assert result[0].tagFQN.root == "PII.NonSensitive"

    def test_no_pii_classification_for_non_pii_data(
        self, processor, mock_metadata, pii_sensitive_email_tag
    ):
        """Test that non-PII data doesn't get classified"""
        column = Column(
            name=ColumnName("product_id"),
            dataType=DataType.VARCHAR,
        )

        # Non-PII data
        sample_data = ["PROD-001", "PROD-002", "PROD-003"]

        mock_metadata.list_all_entities.return_value = [pii_sensitive_email_tag]

        with patch("metadata.pii.tag_processor.TagClassifier") as mock_classifier_cls:
            mock_classifier = Mock(spec=TagClassifier)
            mock_classifier_cls.return_value = mock_classifier

            # Low confidence for all PII tags
            mock_classifier.predict_scores.return_value = {
                pii_sensitive_email_tag.fullyQualifiedName: 0.20,  # Below threshold
            }

            with patch("metadata.pii.tag_processor.normalize_scores") as mock_normalize:
                mock_normalize.return_value = {
                    pii_sensitive_email_tag.fullyQualifiedName: 0.20
                }

                with patch(
                    "metadata.pii.tag_processor.get_top_classes"
                ) as mock_get_top:
                    # No winners due to low confidence
                    mock_get_top.return_value = []

                    result = processor.create_column_tag_labels(column, sample_data)

                    # Should return empty list - no PII detected
                    assert result == []

    def test_mixed_pii_data_chooses_highest_confidence(self, processor, mock_metadata):
        """Test when data contains multiple PII types, highest confidence wins"""
        # Create a column that might contain mixed PII
        column = Column(
            name=ColumnName("user_info"),
            dataType=DataType.VARCHAR,
        )

        # Mixed PII data (emails and names)
        sample_data = [
            "John Doe - john@example.com",
            "Jane Smith - jane@test.org",
            "Bob Wilson - bob@company.net",
        ]

        # Create tags
        pii_sensitive_tag = Tag(
            id=uuid.uuid4(),
            name="Sensitive",
            fullyQualifiedName="PII.Sensitive",
            description="Contains both email and name patterns",
            autoClassificationEnabled=True,
            recognizers=[],  # Would have both email and name recognizers
        )

        mock_metadata.list_all_entities.return_value = [pii_sensitive_tag]

        with patch("metadata.pii.tag_processor.TagClassifier") as mock_classifier_cls:
            mock_classifier = Mock(spec=TagClassifier)
            mock_classifier_cls.return_value = mock_classifier

            # High confidence due to multiple PII patterns
            mock_classifier.predict_scores.return_value = {
                pii_sensitive_tag.fullyQualifiedName: 0.96,
            }

            with patch("metadata.pii.tag_processor.normalize_scores") as mock_normalize:
                mock_normalize.return_value = {
                    pii_sensitive_tag.fullyQualifiedName: 0.96,
                }

                with patch(
                    "metadata.pii.tag_processor.get_top_classes"
                ) as mock_get_top:
                    mock_get_top.return_value = [pii_sensitive_tag.fullyQualifiedName]

                    result = processor.create_column_tag_labels(column, sample_data)

                    assert len(result) == 1
                    assert result[0].tagFQN.root == "PII.Sensitive"

    def test_column_with_non_pii_tag_still_gets_pii_classification(
        self, processor, mock_metadata, pii_sensitive_email_tag
    ):
        """Test that columns with non-PII tags can still get PII classification"""
        # Column already has a data quality tag but contains PII
        column = Column(
            name=ColumnName("customer_email"),
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN="DataQuality.ValidatedEmail",
                    source=TagSource.Classification,
                    state=State.Confirmed,
                    labelType=LabelType.Manual,
                )
            ],
        )

        sample_data = [
            "customer1@example.com",
            "customer2@test.org",
            "customer3@company.net",
        ]

        mock_metadata.list_all_entities.return_value = [pii_sensitive_email_tag]

        with patch("metadata.pii.tag_processor.TagClassifier") as mock_classifier_cls:
            mock_classifier = Mock(spec=TagClassifier)
            mock_classifier_cls.return_value = mock_classifier

            mock_classifier.predict_scores.return_value = {
                pii_sensitive_email_tag.fullyQualifiedName: 0.93
            }

            with patch("metadata.pii.tag_processor.normalize_scores") as mock_normalize:
                mock_normalize.return_value = {
                    pii_sensitive_email_tag.fullyQualifiedName: 0.93
                }

                with patch(
                    "metadata.pii.tag_processor.get_top_classes"
                ) as mock_get_top:
                    mock_get_top.return_value = [
                        pii_sensitive_email_tag.fullyQualifiedName
                    ]

                    result = processor.create_column_tag_labels(column, sample_data)

                    # Should add PII tag even though other tags exist
                    assert len(result) == 1
                    assert result[0].tagFQN.root == "PII.Sensitive"

    @pytest.mark.parametrize(
        "confidence,expected_threshold",
        [
            (90, 0.90),
            (75, 0.75),
            (100, 1.0),
            (50, 0.50),
        ],
    )
    def test_confidence_threshold_initialization(
        self, workflow_config, mock_metadata, confidence, expected_threshold
    ):
        """Test that confidence threshold is correctly initialized from config"""
        workflow_config.source.sourceConfig.config.confidence = confidence

        with patch("metadata.pii.tag_processor.OpenMetadata"):
            processor = TagProcessor(config=workflow_config, metadata=mock_metadata)

        assert processor.confidence_threshold == expected_threshold
