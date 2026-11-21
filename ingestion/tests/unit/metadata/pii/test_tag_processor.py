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

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from dirty_equals import Contains, HasAttributes, IsFloat, IsInstance, IsUUID
from presidio_analyzer.nlp_engine import NlpEngine

from _openmetadata_testutils.factories.metadata.generated.schema.entity.classification.classification import (
    ClassificationFactory,
)
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
            recognizerConfig=PredefinedRecognizerFactory.create(name=Name.EmailRecognizer),
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

    @pytest.mark.parametrize("malformed_spi", [True, False])
    def test_real_sdk_parsing_classifies_acct_num_beside_malformed_spi(
        self, workflow_config, pii_classification, malformed_spi
    ) -> None:
        pattern = PatternFactory.create(name="acct-num", regex="ACCT_NUM", score=0.85)
        pii_recognizer = RecognizerFactory.create(
            name="acct-num",
            recognizerConfig=PatternRecognizerFactory.create(patterns=[pattern], supportedLanguage="en"),
            target=recognizer.Target.column_name,
        )
        pii_tag = TagFactory.create(
            tag_name="PII",
            tag_classification=pii_classification,
            autoClassificationEnabled=True,
            recognizers=[pii_recognizer],
        )
        spi = pii_tag.model_dump(mode="json", exclude_none=True)
        spi["name"] = "SPI"
        spi["fullyQualifiedName"] = "PII.SPI"
        spi["recognizers"][0]["recognizerConfig"]["patterns"][0]["regex"] = "DOES_NOT_MATCH"
        if malformed_spi:
            spi["recognizers"][0]["recognizerConfig"].pop("supportedLanguage")
        sdk = object.__new__(OpenMetadata)
        sdk.client = Mock()
        sdk._use_raw_data = False
        sdk.client.get.side_effect = [
            {"data": [pii_classification.model_dump(mode="json", exclude_none=True)], "paging": {"total": 1}},
            {"data": [pii_tag.model_dump(mode="json", exclude_none=True), spi], "paging": {"total": 2}},
        ]
        workflow_config.source.sourceConfig.config.confidence = 80
        nlp_engine = Mock(spec=NlpEngine)
        nlp_engine.process_text.return_value = SimpleNamespace(tokens=[], tokens_indices=[], lemmas=[], entities=[])
        processor = TagProcessor(
            config=workflow_config,
            metadata=sdk,
            classification_filter=["PII"],
            score_tags_for_column=ScoreTagsForColumnService(nlp_engine=nlp_engine),
        )

        assert [tag.fullyQualifiedName for tag in processor.candidate_tags] == (
            ["PII.PII"] if malformed_spi else ["PII.PII", "PII.SPI"]
        )

        column = Column(
            name=ColumnName(root="ACCT_NUM"), fullyQualifiedName="svc.db.table.ACCT_NUM", dataType=DataType.VARCHAR
        )
        labels = processor.create_column_tag_labels(column, [])
        assert [label.tagFQN.root for label in labels] == ["PII.PII"]

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

    def test_classify_email_column(self, processor: TagProcessor, email_tag: Tag) -> None:
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

    def test_classify_phone_column(self, processor: TagProcessor, phone_tag: Tag) -> None:
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
            classification_manager=FakeClassificationManager((pii_classification, [mixed_tag])),
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

    def test_column_with_non_pii_tag_still_gets_pii_classification(self, processor: TagProcessor) -> None:
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

        classification_manager = FakeClassificationManager((pii_classification, [email_tag]))

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

    def test_builds_tag_label_with_recognizer_metadata(self, email_tag, recognizer_metadata):
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

    def test_wraps_recognizer_metadata_in_tag_label_metadata(self, email_tag, recognizer_metadata):
        scored_tag = ScoredTag(
            tag=email_tag,
            score=0.85,
            reason="Test reason",
            recognizer_metadata=recognizer_metadata,
        )

        tag_label = TagProcessor.build_tag_label(scored_tag)

        assert tag_label.metadata is not None
        assert tag_label.metadata.recognizer is not None
        assert tag_label.metadata.recognizer.recognizerId == recognizer_metadata.recognizerId
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


class TestFilterTagsToAnalyzeNestedFqns:
    """Regression tests for ``TagProcessor.filter_tags_to_analyze`` with nested
    tag FQNs (e.g. ``PII.Sensitive.Email``).

    The mutually-exclusive guard must resolve a tag's owning classification as
    the FIRST FQN segment (the classification root), not the prefix before the
    last dot. A single-level ``rsplit(".", 1)`` resolves a nested tag to its
    parent tag FQN (``PII.Sensitive``) instead of the classification (``PII``),
    so the classification-map lookup misses and conflicting candidates are
    analyzed and applied -- silently violating exclusivity. These tests pin
    the fixed behavior: nested existing tags and nested candidates are
    correctly grouped under their classification for both mutually-exclusive
    and non-mutually-exclusive classifications.
    """

    @pytest.fixture
    def processor(
        self,
        pii_classification: Classification,
        general_classification: Classification,
    ) -> TagProcessor:
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="test_token"),
        )
        config = OpenMetadataWorkflowConfig(
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
        manager = FakeClassificationManager(
            (pii_classification, []),
            (general_classification, []),
        )
        return TagProcessor(
            config=config,
            metadata=Mock(spec=OpenMetadata),
            classification_manager=manager,
            score_tags_for_column=lambda *args, **kwargs: [],
        )

    @staticmethod
    def _column_with_tags(*tag_fqns: str) -> Column:
        return Column(
            name=ColumnName(root="customer_col"),
            fullyQualifiedName="svc.db.schema.table.customer_col",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN=fqn,
                    state=State.Confirmed,
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                )
                for fqn in tag_fqns
            ],
        )

    @staticmethod
    def _fqns(tags: list[Tag]) -> list[str]:
        return [tag.fullyQualifiedName for tag in tags]

    @pytest.mark.parametrize(
        "existing_fqn, candidate_tag_name",
        [
            ("PII.Personal", "Sensitive"),
            ("PII.Personal", "Sensitive.Email"),
            ("PII.Sensitive.Email", "Personal"),
            ("PII.Sensitive.Email", "Sensitive.Phone"),
            ("PII.Sensitive.Email.Personal", "Sensitive"),
            ("PII.Sensitive.Email.Personal", "Sensitive.Email.Phone"),
        ],
    )
    def test_me_classification_blocks_every_existing_candidate_shape_combination(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
        existing_fqn: str,
        candidate_tag_name: str,
    ) -> None:
        """For a mutually-exclusive classification, a tag already on the
        column blocks every candidate from that classification regardless of
        nesting depth on either side (flat vs nested existing tag, flat vs
        nested candidate). The buggy ``rsplit(".", 1)`` only handled the first
        row (flat/flat)."""
        candidate = TagFactory.create(tag_name=candidate_tag_name, tag_classification=pii_classification)

        result = processor.filter_tags_to_analyze(self._column_with_tags(existing_fqn), [candidate])

        assert self._fqns(result) == []

    def test_nested_existing_pii_tag_blocks_flat_candidates(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
    ) -> None:
        """The exact scenario from the bug report: an existing nested
        ``PII.Sensitive.Email`` tag must suppress all other PII candidates."""
        personal = TagFactory.create(tag_name="Personal", tag_classification=pii_classification)
        sensitive = TagFactory.create(tag_name="Sensitive", tag_classification=pii_classification)

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("PII.Sensitive.Email"),
            [personal, sensitive],
        )

        assert self._fqns(result) == []

    def test_flat_existing_pii_tag_blocks_nested_candidate(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
    ) -> None:
        """Symmetric to the reported bug: an existing flat PII tag must
        suppress nested PII candidates too."""
        nested_email = TagFactory.create(tag_name="Sensitive.Email", tag_classification=pii_classification)
        nested_phone = TagFactory.create(tag_name="Sensitive.Phone", tag_classification=pii_classification)

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("PII.Personal"),
            [nested_email, nested_phone],
        )

        assert self._fqns(result) == []

    def test_nested_existing_pii_tag_does_not_block_other_classification(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
        general_classification: Classification,
    ) -> None:
        """A nested existing PII tag must only block PII candidates; candidates
        from a different classification are unaffected."""
        personal = TagFactory.create(tag_name="Personal", tag_classification=pii_classification)
        credit_card = TagFactory.create(tag_name="CreditCard", tag_classification=general_classification)

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("PII.Sensitive.Email"),
            [personal, credit_card],
        )

        assert self._fqns(result) == ["General.CreditCard"]

    def test_non_me_classification_nested_existing_tag_does_not_block(
        self,
        processor: TagProcessor,
        general_classification: Classification,
    ) -> None:
        """``General`` is non-mutually-exclusive: a nested existing General tag
        must not block other General candidates (the exclusivity guard only
        applies to mutually exclusive classifications)."""
        other = TagFactory.create(tag_name="Other", tag_classification=general_classification)

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("General.Sensitive.Email"),
            [other],
        )

        assert self._fqns(result) == ["General.Other"]

    def test_nested_candidate_passes_when_no_existing_tag_in_same_me_classification(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
        general_classification: Classification,
    ) -> None:
        """With no existing tag from a mutually-exclusive classification,
        nested (and flat) candidates pass through the filter untouched."""
        nested_email = TagFactory.create(tag_name="Sensitive.Email", tag_classification=pii_classification)
        personal = TagFactory.create(tag_name="Personal", tag_classification=pii_classification)
        credit_card = TagFactory.create(tag_name="CreditCard", tag_classification=general_classification)

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("General.Sensitive.Email"),
            [nested_email, personal, credit_card],
        )

        assert self._fqns(result) == ["PII.Sensitive.Email", "PII.Personal", "General.CreditCard"]

    def test_candidate_without_classification_ref_uses_fqn_first_segment(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
    ) -> None:
        """A nested candidate whose ``classification`` back-reference is not
        populated must still be blocked under the mutually-exclusive
        classification by resolving the classification from the first FQN
        segment."""
        nested_email_no_ref = TagFactory.create(
            tag_name="Sensitive.Email",
            tag_classification=pii_classification,
            classification=None,
        )
        assert nested_email_no_ref.classification is None
        assert nested_email_no_ref.fullyQualifiedName == "PII.Sensitive.Email"

        result = processor.filter_tags_to_analyze(
            self._column_with_tags("PII.Personal"),
            [nested_email_no_ref],
        )

        assert self._fqns(result) == []

    def test_glossary_term_does_not_block_same_named_me_classification(
        self,
        processor: TagProcessor,
        pii_classification: Classification,
    ) -> None:
        """A glossary term whose FQN shares the classification name (e.g.
        ``PII.Customer.Email`` under a glossary named ``PII``) must NOT occupy
        the mutually-exclusive ``PII`` classification: candidates from ``PII``
        are still analyzed. Only Classification-sourced labels reserve a
        classification; glossary terms merely share the FQN string form."""
        personal = TagFactory.create(tag_name="Personal", tag_classification=pii_classification)

        column = Column(
            name=ColumnName(root="customer_col"),
            fullyQualifiedName="svc.db.schema.table.customer_col",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN="PII.Customer.Email",
                    state=State.Confirmed,
                    source=TagSource.Glossary,
                    labelType=LabelType.Manual,
                ),
            ],
        )

        result = processor.filter_tags_to_analyze(column, [personal])

        assert self._fqns(result) == ["PII.Personal"]


class TestClassificationFqnResolution:
    """Pin ``_classification_fqn_from_tag_fqn`` for dot-quoted and edge-case FQNs.

    The helper resolves a tag's owning classification as the FIRST quote-aware
    FQN segment (the classification root), returned verbatim (quotes intact)
    so it matches the ``classification_map`` key form
    (``classification.fullyQualifiedName.root``). The flat/nested ``PII`` cases
    are covered end-to-end by ``TestFilterTagsToAnalyzeNestedFqns``; this class
    pins the two shapes that the filter tests do not exercise: the dot-quoted
    classification name (``\"My.PII\".Email`` -> ``\"My.PII\"``) where the
    classification name itself contains a dot and is stored quoted in the FQN,
    and the malformed/empty inputs that must degrade to ``None`` rather than
    raise, matching the original ``rsplit``-based code's non-crashing behavior.
    """

    @pytest.mark.parametrize(
        "tag_fqn, expected",
        [
            ('"My.PII".Email', '"My.PII"'),
            ('"My.PII".Sensitive.Email', '"My.PII"'),
            ("PII", None),
            ("", None),
            (None, None),
        ],
    )
    def test_classification_fqn_from_tag_fqn(self, tag_fqn: str | None, expected: str | None) -> None:
        from metadata.pii.tag_processor import _classification_fqn_from_tag_fqn

        assert _classification_fqn_from_tag_fqn(tag_fqn) == expected


class TestFilterTagsToAnalyzeQuotedClassificationFqn:
    """Filter-level coverage for classifications whose names contain a dot.

    The server stores such a classification's FQN quoted, e.g. ``"My.PII"``,
    and tags under it carry the quoted first segment in their FQN
    (``"My.PII".Email``). The mutually-exclusive guard must resolve the owning
    classification preserving the quotes so the ``classification_map`` lookup
    (keyed by ``classification.fullyQualifiedName.root``) hits; the earlier
    ``unquote_name``-based version returned ``My.PII`` and the lookup silently
    missed, so conflicting candidates stayed eligible.
    """

    @staticmethod
    def _processor_with(classification: Classification) -> TagProcessor:
        server_config = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="test_token"),
        )
        config = OpenMetadataWorkflowConfig(
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
        manager = FakeClassificationManager((classification, []))
        return TagProcessor(
            config=config,
            metadata=Mock(spec=OpenMetadata),
            classification_manager=manager,
            score_tags_for_column=lambda *args, **kwargs: [],
        )

    @staticmethod
    def _column_with_classification_tags(*tag_fqns: str) -> Column:
        return Column(
            name=ColumnName(root="customer_col"),
            fullyQualifiedName="svc.db.schema.table.customer_col",
            dataType=DataType.VARCHAR,
            tags=[
                TagLabel(
                    tagFQN=fqn,
                    state=State.Confirmed,
                    source=TagSource.Classification,
                    labelType=LabelType.Manual,
                )
                for fqn in tag_fqns
            ],
        )

    def test_quoted_classification_existing_tag_blocks_candidates(self) -> None:
        """An existing tag under a dot-named mutually-exclusive classification
        (``"My.PII"``) blocks every candidate from that classification,
        including nested candidates."""
        dotted = ClassificationFactory.create(
            fqn='"My.PII"',
            mutuallyExclusive=True,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__minimumConfidence=0.7,
        )
        processor = self._processor_with(dotted)

        email = TagFactory.create(tag_name="Email", tag_classification=dotted)
        personal = TagFactory.create(tag_name="Personal", tag_classification=dotted)
        nested = TagFactory.create(tag_name="Sensitive.Email", tag_classification=dotted)

        assert email.fullyQualifiedName == '"My.PII".Email'
        assert nested.fullyQualifiedName == '"My.PII".Sensitive.Email'

        column = self._column_with_classification_tags('"My.PII".Sensitive')

        result = processor.filter_tags_to_analyze(column, [email, personal, nested])

        assert [tag.fullyQualifiedName for tag in result] == []

    def test_quoted_classification_candidate_passes_without_existing_tag(self) -> None:
        """With no existing tag under a dot-named classification, candidates
        (flat and nested) pass through the filter untouched."""
        dotted = ClassificationFactory.create(
            fqn='"My.PII"',
            mutuallyExclusive=True,
            autoClassificationConfig__enabled=True,
            autoClassificationConfig__minimumConfidence=0.7,
        )
        processor = self._processor_with(dotted)

        email = TagFactory.create(tag_name="Email", tag_classification=dotted)
        nested = TagFactory.create(tag_name="Sensitive.Email", tag_classification=dotted)

        column = self._column_with_classification_tags()

        result = processor.filter_tags_to_analyze(column, [email, nested])

        assert [tag.fullyQualifiedName for tag in result] == [
            '"My.PII".Email',
            '"My.PII".Sensitive.Email',
        ]
