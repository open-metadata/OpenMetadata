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
from unittest.mock import Mock

import pytest
from dirty_equals import Contains, HasAttributes, IsFloat, IsInstance, IsUUID

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.tag import (
    TagFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.basic import (
    UuidFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    PatternFactory,
    PatternRecognizerFactory,
    PredefinedRecognizerFactory,
    RecognizerFactory,
)
from _openmetadata_testutils.factories.metadata.pii.models import ScoredTagFactory
from _openmetadata_testutils.pii.fake_classification_manager import (
    FakeClassificationManager,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
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
from metadata.generated.schema.type import recognizer, tagLabelRecognizerMetadata
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.classificationLanguages import (
    ClassificationLanguage,
)
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import RecognizerException
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagFQN,
    TagLabel,
    TagSource,
)
from metadata.generated.schema.type.tagLabelMetadata import TagLabelMetadata
from metadata.generated.schema.type.tagLabelRecognizerMetadata import (
    PatternMatch,
    TagLabelRecognizerMetadata,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.algorithms.tag_scoring import ScoreTagsForColumnService
from metadata.pii.models import ScoredTag
from metadata.pii.tag_processor import TagProcessor


class TestTagProcessor:
    """Test the TagProcessor class"""

    @pytest.fixture
    def workflow_config(self) -> OpenMetadataWorkflowConfig:
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
    def email_tag(self, pii_classification: Classification) -> Tag:
        """Create an email tag for testing"""
        email_recognizer = RecognizerFactory.create(
            name="Email",
            description="Recognizes email addresses",
            recognizerConfig=PredefinedRecognizerFactory.create(
                name=Name.EmailRecognizer
            ),
            confidenceThreshold=0.8,
            exceptionList=[],
            target=recognizer.Target.content,
        )
        return TagFactory.create(
            tag_name="EmailTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[email_recognizer],
            description="Tag for email addresses",
        )

    @pytest.fixture
    def phone_tag(self, pii_classification: Classification) -> Tag:
        """Create a phone tag for testing"""
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
            target=recognizer.Target.content,
        )
        return TagFactory.create(
            tag_name="PhoneTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[phone_recognizer],
            description="Tag for phone numbers",
        )

    @pytest.fixture
    def classification_manager(
        self, email_tag: Tag, phone_tag: Tag, pii_classification: Classification
    ) -> FakeClassificationManager:
        return FakeClassificationManager((pii_classification, [email_tag, phone_tag]))

    @pytest.fixture
    def mock_metadata(self) -> Mock:
        """Create mock metadata client"""
        return Mock(spec=OpenMetadata)

    @pytest.fixture
    def score_tags_for_column(self) -> ScoreTagsForColumnService:
        """Create mock NLP engine client"""
        return ScoreTagsForColumnService()

    @pytest.fixture
    def processor(
        self,
        workflow_config: OpenMetadataWorkflowConfig,
        mock_metadata: Mock,
        classification_manager: FakeClassificationManager,
        score_tags_for_column: ScoreTagsForColumnService,
    ) -> TagProcessor:
        """Create TagProcessor instance"""
        return TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
            classification_manager=classification_manager,
            score_tags_for_column=score_tags_for_column,
        )

    def test_build_tag_label(self) -> None:
        """Test building a tag label"""
        tag_label = TagProcessor.build_tag_label(
            ScoredTagFactory.create(
                tag__tag_name="EmailTag",
                tag__tag_classification__fqn="PII",
            ),
        )

        assert isinstance(tag_label, TagLabel)
        assert tag_label.tagFQN.root == "PII.EmailTag"
        assert tag_label.source is TagSource.Classification
        assert tag_label.state is State.Suggested
        assert tag_label.labelType is LabelType.Generated

    def test_skip_column_with_existing_pii_tag(self, processor: TagProcessor) -> None:
        """Test that columns with existing PII tags are skipped"""
        # Create column with existing PII tag
        column = Column(
            name=ColumnName(root="customer_email"),
            fullyQualifiedName="Service.database.schema.table.customer_email",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN="PII.EmailTag",
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

    def test_classify_email_column(
        self, processor: TagProcessor, email_tag: Tag
    ) -> None:
        """Test classifying an email column"""
        column = Column(
            name=ColumnName(root="customer_email"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.customer_email",
        )

        # Real email data
        sample_data = [
            "john.doe@example.com",
            "jane.smith@company.org",
            "bob.wilson@test.net",
        ]

        result = processor.create_column_tag_labels(column, sample_data)

        # Should detect email tag
        assert len(result) == 1
        assert result[0] == IsInstance(TagLabel) & HasAttributes(
            tagFQN=TagFQN(root="PII.EmailTag"),
            state=State.Suggested,
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            metadata=IsInstance(TagLabelMetadata)
            & HasAttributes(
                recognizer=IsInstance(TagLabelRecognizerMetadata)
                & HasAttributes(
                    recognizerId=IsInstance(Uuid) & HasAttributes(root=IsUUID()),
                    recognizerName="EmailRecognizer",
                    target=tagLabelRecognizerMetadata.Target.content,
                    score=IsFloat(gt=0.80),
                    patterns=Contains(IsInstance(PatternMatch)),
                )
            ),
        )

    def test_classify_phone_column(
        self, processor: TagProcessor, phone_tag: Tag
    ) -> None:
        """Test classifying a phone number column"""
        column = Column(
            name=ColumnName(root="phone_number"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.phone_number",
        )

        # Real phone number data
        sample_data = ["555-123-4567", "555.987.6543", "5551234567"]

        result = processor.create_column_tag_labels(column, sample_data)

        # Should detect phone tag
        assert len(result) == 1
        assert result[0] == IsInstance(TagLabel) & HasAttributes(
            tagFQN=TagFQN(root="PII.PhoneTag"),
            state=State.Suggested,
            source=TagSource.Classification,
            labelType=LabelType.Generated,
            metadata=IsInstance(TagLabelMetadata)
            & HasAttributes(
                recognizer=IsInstance(TagLabelRecognizerMetadata)
                & HasAttributes(
                    recognizerId=IsInstance(Uuid) & HasAttributes(root=IsUUID()),
                    recognizerName="PhoneRecognizer",
                    target=tagLabelRecognizerMetadata.Target.content,
                )
            ),
        )

    def test_no_classification_for_non_pii_data(self, processor: TagProcessor) -> None:
        """Test that non-PII data doesn't get classified"""
        column = Column(
            name=ColumnName(root="product_id"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.product_id",
        )

        # Non-PII data
        sample_data = ["PROD-001", "PROD-002", "PROD-003"]

        result = processor.create_column_tag_labels(column, sample_data)

        # Should return empty list - no PII detected
        assert result == []

    def test_mixed_pii_data_chooses_highest_confidence(
        self,
        processor: TagProcessor,
        workflow_config: OpenMetadataWorkflowConfig,
        mock_metadata: Mock,
        score_tags_for_column: ScoreTagsForColumnService,
        pii_classification: Classification,
        classification_manager: FakeClassificationManager,
    ) -> None:
        """Test when data contains multiple PII types, highest confidence wins"""
        # Create tags for mixed PII
        email_pattern = PatternFactory.create(
            name="Email pattern",
            regex="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            score=1.0,
        )
        name_pattern = PatternFactory.create(
            name="Name pattern",
            regex="\\b[A-Z][a-z]+ [A-Z][a-z]+\\b",
            score=1.0,
        )
        mixed_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[email_pattern, name_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        mixed_recognizer = RecognizerFactory.create(
            name="MixedRecognizer",
            description="Recognizes multiple PII types",
            recognizerConfig=mixed_pattern_recognizer,
            confidenceThreshold=0.7,
            exceptionList=[],
            target=recognizer.Target.content,
        )
        mixed_tag = TagFactory.create(
            tag_name="MixedTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[mixed_recognizer],
            description="Tag for mixed PII",
        )

        processor = TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
            classification_manager=classification_manager.extend(
                (pii_classification, [mixed_tag]),
            ),
            score_tags_for_column=score_tags_for_column,
        )

        column = Column(
            name=ColumnName(root="user_info"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.user_info",
        )

        # Mixed PII data (emails and names)
        sample_data = [
            "John Doe - john@example.com",
            "Jane Smith - jane@test.org",
            "Bob Wilson - bob@company.net",
        ]

        result = processor.create_column_tag_labels(column, sample_data)

        # Should detect mixed PII
        assert len(result) == 1
        assert result[0].tagFQN.root == "PII.MixedTag"

    def test_column_with_non_pii_tag_still_gets_pii_classification(
        self, processor: TagProcessor
    ) -> None:
        """Test that columns with non-PII tags can still get PII classification"""
        # Column already has a data quality tag but contains PII
        column = Column(
            name=ColumnName(root="customer_email"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.customer_email",
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

        result = processor.create_column_tag_labels(column, sample_data)

        # Should add PII tag even though other tags exist
        assert len(result) == 1
        assert result[0].tagFQN.root == "PII.EmailTag"

    def test_ssn_classification_with_custom_analyzer(
        self,
        workflow_config: OpenMetadataWorkflowConfig,
        mock_metadata: Mock,
        score_tags_for_column: ScoreTagsForColumnService,
        pii_classification: Classification,
        classification_manager: FakeClassificationManager,
    ) -> None:
        """Test SSN classification with a custom tag analyzer"""
        ssn_pattern = PatternFactory.create(
            name="SSN pattern",
            regex="\\b\\d{3}-\\d{2}-\\d{4}\\b",
            score=0.98,
        )
        ssn_pattern_recognizer = PatternRecognizerFactory.create(
            patterns=[ssn_pattern],
            context=[],
            supportedLanguage=ClassificationLanguage.en,
        )
        ssn_recognizer = RecognizerFactory.create(
            name="SSNRecognizer",
            description="Recognizes SSN",
            recognizerConfig=ssn_pattern_recognizer,
            confidenceThreshold=0.9,
            exceptionList=[],
            target=recognizer.Target.content,
        )

        ssn_tag = TagFactory.create(
            tag_name="SSNTag",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[ssn_recognizer],
            description="Tag for SSN",
        )

        processor_with_ssn = TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
            classification_manager=classification_manager.extend(
                (pii_classification, [ssn_tag]),
            ),
            score_tags_for_column=score_tags_for_column,
        )

        column = Column(
            name=ColumnName(root="social_security_number"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test.table.social_security_number",
        )

        sample_data = ["123-45-6789", "987-65-4321", "555-12-3456"]

        result = processor_with_ssn.create_column_tag_labels(column, sample_data)

        assert len(result) == 1
        assert result[0].tagFQN.root == "PII.SSNTag"

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
        self,
        workflow_config: OpenMetadataWorkflowConfig,
        mock_metadata: Mock,
        confidence: float,
        expected_threshold: float,
    ):
        """Test that confidence threshold is correctly initialized from config"""
        workflow_config.source.sourceConfig.config.confidence = confidence

        processor = TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
        )

        assert processor.confidence_threshold == expected_threshold

    @pytest.fixture
    def email_tag_with_exception_list(self, email_tag: Tag) -> Tag:
        # Create recognizers with exception list based on email_tag recognizers
        recognizers_with_exceptions = [
            RecognizerFactory.create(
                name="EmailRecognizer",
                description="Recognizes email addresses",
                recognizerConfig=r.recognizerConfig,
                confidenceThreshold=0.8,
                exceptionList=[
                    RecognizerException(
                        entityLink="<#E::table::test_db.test_schema.test_table::columns::test_column>",
                        reason="It didn't work",
                    )
                ],
                target=recognizer.Target.content,
            )
            for r in email_tag.recognizers
        ]
        return TagFactory.create(
            tag_name="EmailTag",
            classification=None,
            autoClassificationEnabled=True,
            recognizers=recognizers_with_exceptions,
            description="Tag for email addresses",
        )

    def test_it_skips_recognizers_with_exception_lists(
        self,
        workflow_config: OpenMetadataWorkflowConfig,
        mock_metadata: Mock,
        score_tags_for_column: ScoreTagsForColumnService,
        pii_classification: Classification,
        email_tag: Tag,
        email_tag_with_exception_list: Tag,
    ) -> None:
        column = Column(
            name=ColumnName(root="test_column"),
            dataType=DataType.VARCHAR,
            fullyQualifiedName="test_db.test_schema.test_table.test_column",
        )

        sample_data = [
            "john@example.com",
            "jane@test.org",
            "bob@company.net",
        ]

        classification_manager = FakeClassificationManager(
            (pii_classification, [email_tag])
        )

        processor = TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
            classification_manager=classification_manager,
            score_tags_for_column=score_tags_for_column,
        )

        result = processor.create_column_tag_labels(column, sample_data)

        # Should detect Email PII
        assert len(result) == 1
        assert result[0].tagFQN.root == "PII.EmailTag"

        classification_manager = FakeClassificationManager(
            (pii_classification, [email_tag_with_exception_list]),
        )

        processor = TagProcessor(
            config=workflow_config,
            metadata=mock_metadata,
            classification_manager=classification_manager,
            score_tags_for_column=score_tags_for_column,
        )

        result = processor.create_column_tag_labels(column, sample_data)

        # Should not detect Email PII
        assert len(result) == 0


class TestBuildTagLabel:
    @pytest.fixture
    def email_tag(self):
        return TagFactory.create(
            tag_name="Email",
            tag_classification__name="PII",
        )

    @pytest.fixture
    def recognizer_metadata(self):
        return TagLabelRecognizerMetadata(
            recognizerId=UuidFactory.create(),
            recognizerName="email_recognizer",
            score=0.85,
            target=tagLabelRecognizerMetadata.Target.content,
            patterns=[
                PatternMatch(name="email_pattern", regex="pattern", score=0.9),
                PatternMatch(name="simple_email", regex="pattern", score=0.8),
            ],
        )

    def test_builds_tag_label_without_recognizer_metadata(self, email_tag):
        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.85,
            reason="Detected by recognizer",
            recognizer_metadata=None,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        assert tag_label.tagFQN.root == email_tag.fullyQualifiedName
        assert tag_label.source == TagSource.Classification
        assert tag_label.state == State.Suggested
        assert tag_label.labelType == LabelType.Generated
        assert tag_label.reason == "Detected by recognizer"
        assert tag_label.metadata is None

    def test_builds_tag_label_with_recognizer_metadata(
        self, email_tag, recognizer_metadata
    ):
        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.85,
            reason="Detected by email_recognizer",
            recognizer_metadata=recognizer_metadata,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        assert tag_label.tagFQN.root == email_tag.fullyQualifiedName
        assert tag_label.source == TagSource.Classification
        assert tag_label.state == State.Suggested
        assert tag_label.labelType == LabelType.Generated
        assert tag_label.reason == "Detected by email_recognizer"
        assert tag_label.metadata is not None
        assert tag_label.metadata.recognizer == recognizer_metadata

    def test_wraps_recognizer_metadata_in_tag_label_metadata(
        self, email_tag, recognizer_metadata
    ):
        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.85,
            reason="Test reason",
            recognizer_metadata=recognizer_metadata,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        assert tag_label.metadata is not None
        assert tag_label.metadata.recognizer is not None
        assert (
            tag_label.metadata.recognizer.recognizerId
            == recognizer_metadata.recognizerId
        )
        assert tag_label.metadata.recognizer.recognizerName == "email_recognizer"
        assert tag_label.metadata.recognizer.score == 0.85
        assert tag_label.metadata.recognizer.target.value == "content"
        assert tag_label.metadata.recognizer.patterns is not None
        assert len(tag_label.metadata.recognizer.patterns) == 2

    def test_preserves_pattern_information(self, email_tag, recognizer_metadata):
        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.85,
            reason="Matched patterns",
            recognizer_metadata=recognizer_metadata,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        patterns = tag_label.metadata.recognizer.patterns
        assert patterns[0].name == "email_pattern"
        assert patterns[0].score == 0.9
        assert patterns[1].name == "simple_email"
        assert patterns[1].score == 0.8

    def test_handles_recognizer_metadata_without_patterns(self, email_tag):
        metadata_no_patterns = TagLabelRecognizerMetadata(
            recognizerId=UuidFactory.create(),
            recognizerName="test_recognizer",
            score=0.7,
            target=tagLabelRecognizerMetadata.Target.column_name,
            patterns=None,
        )

        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.7,
            reason="No patterns",
            recognizer_metadata=metadata_no_patterns,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        assert tag_label.metadata is not None
        assert tag_label.metadata.recognizer is not None
        assert tag_label.metadata.recognizer.patterns is None
